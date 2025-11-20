import { EOL } from "node:os";
import type { Writable } from "node:stream";
import { styleText } from "node:util";
import { Node, type NodeConfig, NodeStatus } from "./node";

export interface CommandConfig extends NodeConfig {
  command: string[];
  environment?: Record<string, string>;
}

export class Command extends Node {
  private command: string[];
  private environment: Record<string, string> | undefined;
  private process?: Bun.Subprocess<"ignore", "pipe", "pipe">;

  constructor(config: CommandConfig) {
    super(config);
    this.command = config.command;
    this.environment = config.environment;
  }

  override async execute(stderr: Writable = process.stderr, stdout: Writable = process.stdout): Promise<NodeStatus> {
    const result = await super.execute();
    if (result === NodeStatus.FAIL) return result;

    if (!this.process) {
      this.process = Bun.spawn({
        cmd: this.command,
        cwd: this.cwd,
        env: { ...process.env, ...this.environment },
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      });

      await Promise.all([
        this.stream(this.process.stdout, (line) => stdout.write(`[${styleText(this.color, this.fqn)}]: ${line}\n`)),
        this.stream(this.process.stderr, (line) => stderr.write(`[${styleText(this.color, this.fqn)}]: ${line}\n`)),
      ]);
    }

    if ((await this.process.exited) === 0) return NodeStatus.SUCCESS;
    else return NodeStatus.FAIL;
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
}
