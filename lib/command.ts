import { EOL } from "node:os";
import type { Writable } from "node:stream";
import { styleText } from "node:util";
import { TaskStatus } from "./status";
import { type ExecuteOptions, Task, type TaskConfig } from "./task";

export interface CommandConfig extends TaskConfig {
  environment?: Record<string, string>;
}

export class Command extends Task {
  private command: string[];
  private environment: Record<string, string> | undefined;
  private process?: Bun.Subprocess<"ignore", "pipe", "pipe">;

  constructor(config: CommandConfig, ...command: string[]) {
    const action = async (options: ExecuteOptions = {}): Promise<TaskStatus> => {
      const stderr: Writable = options.stderr ?? process.stderr;
      const stdout: Writable = options.stdout ?? process.stdout;
      const prefix = options.logger?.prefix ?? `[${styleText("yellow", this.name)}]`;

      if (!this.process) {
        this.process = Bun.spawn({
          cmd: this.command,
          cwd: this.cwd ?? process.cwd(),
          env: { ...process.env, ...this.environment },
          stderr: "pipe",
          stdin: "ignore",
          stdout: "pipe",
        });

        const writeStdout = (line: string) => (options.logger ? options.logger.info(`${prefix}: ${line}`) : stdout.write(`${prefix}: ${line}\n`));
        const writeStderr = (line: string) => (options.logger ? options.logger.error(`${prefix}: ${line}`) : stderr.write(`${prefix}: ${line}\n`));

        await Promise.all([stream(this.process.stdout, writeStdout), stream(this.process.stderr, writeStderr)]);
      }

      if ((await this.process.exited) === 0) return TaskStatus.SUCCESS;
      else return TaskStatus.FAIL;
    };

    super(config, action);
    this.command = command;
    this.environment = config.environment;
    if (this.command.length === 0) throw new Error("command must not be empty");
  }
}

const stream = async (stream: ReadableStream<Uint8Array> | undefined, handler: (msg: string) => void) => {
  if (!stream) return;
  const decoder = new TextDecoder();
  for await (const input of stream) {
    decoder
      .decode(input, { stream: true })
      .split(EOL)
      .filter((line) => line)
      .forEach(handler);
  }
};
