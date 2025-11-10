import type { Writable } from "node:stream";
import { Task, type TaskConfig } from "#/lib/task";

type TaskFunction = NonNullable<TaskConfig["run"]>;

export class FunctionTask extends Task {
  private run: TaskFunction;

  constructor(config: TaskConfig & { run: TaskFunction }) {
    super(config);
    this.run = config.run;
  }

  protected async runTask(_: Writable, __: Writable): Promise<number> {
    const result = await this.run();
    return typeof result === "number" ? result : 0;
  }
}
