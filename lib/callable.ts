import { TaskStatus } from "./status";
import { type Action, Task, type TaskConfig } from "./task";

export interface CallableConfig extends TaskConfig {
  task: Action;
}

export class Callable extends Task {
  constructor(config: CallableConfig) {
    super(config, config.task);
  }
}
