import { EOL } from "node:os";
import { styleText } from "node:util";
import { type SpawnOptions, stderr, stdout } from "bun";
import { type Color, random } from "#/lib/color";
import type { Namespace } from "#/lib/namespace";

export interface TaskConfig {
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
    this.color = random();
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

  // TODO: take a single task or fqn, resolve it to a task, don't select for dependencies.
  // TODO: move this to the parent namespace.
  private resolve(task: string | Task, namespace: Namespace): Task[] {
    if (task instanceof Task) return [task];
    const tasks = namespace.root.select(new RegExp(task));
    return tasks.filter((task) => task.fqn !== this.fqn);
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
      this.stream(this.process.stdout, (line) => stdout.write(styleText(this.color, `[${this.fqn}]: ${line}\n`))),
      this.stream(this.process.stderr, (line) => stderr.write(styleText(this.color, `[${this.fqn}]: ${line}\n`))),
    ]);

    return await this.process.exited;
  }
}
