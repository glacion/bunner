import { EOL } from "node:os";
import type { Writable } from "node:stream";
import { styleText } from "node:util";
import type { SpawnOptions } from "bun";
import { Task, type TaskConfig } from "#/lib/task";

export class CommandTask extends Task {
  private command: string[];

  constructor(config: TaskConfig & { command: string[] }) {
    super(config);
    this.command = config.command;
  }

  protected async runTask(stderr: Writable, stdout: Writable): Promise<number> {
    const options: SpawnOptions.OptionsObject<"ignore", "pipe", "pipe"> = {
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    };

    const cwd = this.directory ?? this.namespace.directory;
    if (cwd) options.cwd = cwd;
    if (this.environment) options.env = { ...process.env, ...this.environment };
    const proc = Bun.spawn<"ignore", "pipe", "pipe">(this.command, options);

    const exitPromise = proc.exited;
    const prefix = this.formatPrefix();

    await Promise.all([
      this.stream(proc.stdout, (line) => stdout.write(`${prefix}: ${line}\n`)),
      this.stream(proc.stderr, (line) => stderr.write(`${prefix}: ${line}\n`)),
      exitPromise,
    ]);

    return await exitPromise;
  }

  private formatPrefix() {
    return `[${styleText(this.color, this.fqn)}]`;
  }

  private async stream(stream: ReadableStream<Uint8Array> | undefined, handler: (msg: string) => void) {
    if (!stream) return;
    const decoder = new TextDecoder();
    const reader = stream.getReader();

    const pump = (): Promise<void> =>
      reader.read().then(({ done, value }) => {
        if (done) return;
        decoder
          .decode(value, { stream: true })
          .split(EOL)
          .filter((line) => line.length > 0)
          .forEach(handler);
        return pump();
      });

    await pump();
  }
}
