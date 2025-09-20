import { EOL } from "node:os";
import type { SpawnOptions } from "bun";
import type { Namespace } from "#/src/namespace";

export interface TaskConfig {
  command?: string[];
  dependencies?: (string | Task)[];
  description?: string;
  directory?: string;
  environment?: Record<string, string>;
  name: string;
  namespace: Namespace;
}

export class Task {
  description: string;
  fqdn: string;

  private command: string[] | undefined;
  private dependencies: (string | Task)[];
  private directory: string | undefined;
  private environment: Record<string, string> | undefined;
  name: string;
  private namespace: Namespace;
  private process?: Bun.Subprocess<"ignore", "pipe", "pipe">;

  constructor(config: TaskConfig) {
    this.command = config.command;
    this.dependencies = config.dependencies ?? [];
    this.description = config.description ?? "";
    this.directory = config.directory;
    this.environment = config.environment;
    this.name = config.name;
    this.namespace = config.namespace;

    this.fqdn = `${this.namespace.fqdn}:${this.name}`;
  }

  private async stream(stream: ReadableStream<Uint8Array> | undefined, handler: (msg: string) => void) {
    if (!stream) return; // Process never opened the stream
    const decoder = new TextDecoder();
    for await (const input of stream) {
      decoder
        .decode(input, { stream: true })
        .split(EOL)
        .filter((line) => line) // Discard final newline
        .forEach(handler);
    }
  }

  private resolve(pattern: string | Task, namespace: Namespace): Task[] {
    if (pattern instanceof Task) return [pattern];
    const tasks = namespace.root().select(new RegExp(pattern));
    return tasks.filter((task) => task.fqdn !== this.fqdn);
  }

  async spawn(): Promise<number> {
    const dependencies = this.dependencies.flatMap((task) => this.resolve(task, this.namespace));
    const codes = await Promise.all(dependencies.map((dependency) => dependency.spawn()));
    const code = codes.reduce((previous, current) => previous + current, 0);
    if (code !== 0 || !this.command) return code; // Any of the dependencies failed or task is a metatask
    if (this.process) return this.process.exited; // Do not spawn the command again

    const options: SpawnOptions.OptionsObject<"ignore", "pipe", "pipe"> = {
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    };

    if (this.namespace.directory) options.cwd = this.namespace.directory;
    if (this.directory) options.cwd = this.directory;
    if (this.environment) options.env = { ...process.env, ...this.environment };
    this.process = Bun.spawn<"ignore", "pipe", "pipe">(this.command, options);

    await Promise.all([
      this.stream(this.process.stdout, (line) => console.log(`[${this.fqdn}]: ${line}`)),
      this.stream(this.process.stderr, (line) => console.error(`[${this.fqdn}]: ${line}`)),
    ]);

    return await this.process.exited;
  }
}
