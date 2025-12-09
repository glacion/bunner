import Docker from 'dockerode';
import { EOL } from "node:os";
import type { Writable } from "node:stream";
import { styleText } from "node:util";
import { TaskStatus } from "./status";
import { Task, type TaskConfig, type ExecuteConfig } from "./task";

export interface ContainerConfig extends TaskConfig {
  image: string;
  command?: string[]; // Overriding command to be optional for Container
  environment?: Record<string, string>;
  volumes?: Record<string, string>; // { hostPath: containerPath }
  user?: string;
  platform?: string; // e.g., linux/amd64, linux/arm64
  flags?: string[]; // Additional flags to pass to docker run (e.g. ['--network', 'host'])
}

export class Container extends Task {
  private docker: Docker;
  private containerCommand: string[];
  private containerEnvironment: Record<string, string> | undefined;
  private containerVolumes: Record<string, string> | undefined;
  private containerUser: string | undefined;
  private containerPlatform: string | undefined;
  private containerFlags: string[] | undefined;
  private containerImage: string;

  constructor(config: ContainerConfig, ...command: string[]) {
    const action = async (options: ExecuteConfig = {}): Promise<TaskStatus> => {
      const stderr: Writable = options.stderr ?? process.stderr;
      const stdout: Writable = options.stdout ?? process.stdout;
      const prefix = options.logger?.prefix ?? `[${styleText("cyan", this.name)}]`;

      const writeStdout = (line: string) => (options.logger ? options.logger.info(`${prefix}: ${line}`) : stdout.write(`${prefix}: ${line}\n`));
      const writeStderr = (line: string) => (options.logger ? options.logger.error(`${prefix}: ${line}`) : stderr.write(`${prefix}: ${line}\n`));

      const workDir = this.directory ?? process.cwd();

      const binds: string[] = [];
      // Mount the working directory to ensure files are accessible
      // We default to mounting the project root or the specified directory
      // to the same path inside the container.
      binds.push(`${workDir}:${workDir}`);

      if (this.containerVolumes) {
        Object.entries(this.containerVolumes).forEach(([host, containerPath]) => {
          binds.push(`${host}:${containerPath}`);
        });
      }

      const createOptions: Docker.ContainerCreateOptions = {
        Image: this.containerImage,
        Cmd: this.containerCommand,
        Env: this.containerEnvironment ? Object.entries(this.containerEnvironment).map(([key, value]) => `${key}=${value}`) : undefined,
        WorkingDir: workDir,
        HostConfig: {
          Binds: binds,
          // AutoRemove: true, // We manually remove to ensure we can wait/log
        },
        Tty: false, // Allocate a pseudo-TTY if needed, but typically not for task execution
        AttachStdout: true,
        AttachStderr: true,
      };

      if (this.containerPlatform) {
        createOptions.Platform = this.containerPlatform;
      }
      if (this.containerUser) {
        createOptions.User = this.containerUser;
      }

      // Merge additional flags (these need to be carefully mapped to dockerode options)
      // For simplicity, directly passing flags is harder with dockerode's structured API.
      // If flags contain e.g. '--network', it needs to be mapped to HostConfig.NetworkMode.
      // For now, we'll keep it simple and focus on core options.
      // A more robust solution would parse these flags and apply them to createOptions.

      let container: Docker.Container;
      try {
        writeStderr(`[DEBUG] Creating container with options: ${JSON.stringify(createOptions, null, 2)}`);
        container = await this.docker.createContainer(createOptions);
        writeStderr(`[DEBUG] Container ID: ${container.id}`);
      } catch (e: any) {
        writeStderr(`Failed to create container: ${e.message}`);
        return TaskStatus.FAIL;
      }

      try {
        writeStderr(`[DEBUG] Starting container ${container.id}`);
        await container.start();

        const logStream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
        });

        // Split the stream into stdout and stderr
        this.docker.modem.demuxStream(logStream, stdout, stderr);

        const data = await container.wait();
        writeStderr(`[DEBUG] Container wait data: ${JSON.stringify(data)}`);
        
        if (data.StatusCode === 0) {
          return TaskStatus.SUCCESS;
        } else {
          writeStderr(`Container exited with code: ${data.StatusCode}`);
          return TaskStatus.FAIL;
        }
      } catch (e: any) {
        writeStderr(`Error during container execution: ${e.message}`);
        return TaskStatus.FAIL;
      } finally {
        try {
          // Ensure we clean up
          await container.remove({ force: true }); 
        } catch (removeErr: any) {
           writeStderr(`Failed to remove container: ${removeErr.message}`);
        }
      }
    };

    super(config, action);
    this.docker = new Docker(); // Initialize dockerode
    this.containerImage = config.image;
    this.containerCommand = command; // Use the rest of the arguments as the command
    this.containerEnvironment = config.environment;
    this.containerVolumes = config.volumes;
    this.containerUser = config.user;
    this.containerPlatform = config.platform;
    this.containerFlags = config.flags; // Store for potential future structured mapping
    if (this.containerCommand.length === 0 && !config.command) throw new Error("command must not be empty for a Container task");
    if (!this.containerImage) throw new Error("image must be specified for a Container task");

    // If a command is provided in config, it takes precedence
    if (config.command && config.command.length > 0) {
      this.containerCommand = config.command;
    }
  }
}

// Helper to demultiplex the stream (from command.ts for consistency, though dockerode handles it internally)
const stream = async (stream: ReadableStream<Uint8Array> | undefined, handler: (msg: string) => void) => {
  if (!stream) return;
  const decoder = new TextDecoder();
  const reader = stream.getReader();

  const read = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) return;
    decoder
      .decode(value, { stream: true })
      .split(EOL)
      .filter((line) => line)
      .forEach(handler);
    return read();
  };

  await read();
};
