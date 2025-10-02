import { EOL } from "node:os";
import type { Writable } from "node:stream";
import { styleText } from "node:util";
import type { SpawnOptions } from "bun";
import { type Color, random } from "#/lib/color";
import type { Namespace } from "#/lib/namespace";

export interface TaskConfig {
  color?: Color;
  command?: string[];
  dependencies?: (string | Task)[];
  directory?: string;
  environment?: Record<string, string>;
  name: string;
  namespace: Namespace;
}

export class Task {
  private color: Color;
  private command: string[] | undefined;
  private dependencies: (string | Task)[];
  private directory: string | undefined;
  private environment: Record<string, string> | undefined;
  name: string;
  private namespace: Namespace;
  private process?: Bun.Subprocess<"ignore", "pipe", "pipe">;

  constructor(config: TaskConfig) {
    this.color = config.color ?? random();
    this.command = config.command;
    this.dependencies = config.dependencies ?? [];
    this.directory = config.directory;
    this.environment = config.environment;
    this.name = config.name;
    this.namespace = config.namespace;
  }

  get fqn(): string {
    return `${this.namespace.fqn}:${this.name}`;
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

  async spawn(stderr: Writable = process.stderr, stdout: Writable = process.stdout): Promise<number> {
    const dependencies = this.dependencies.map((task) => this.namespace.resolve(task));
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
      this.stream(this.process.stdout, (line) => stdout.write(`[${styleText(this.color, this.fqn)}]: ${line}\n`)),
      this.stream(this.process.stderr, (line) => stderr.write(`[${styleText(this.color, this.fqn)}]: ${line}\n`)),
      this.process.exited,
    ]);

    return await this.process.exited;
  }
}
