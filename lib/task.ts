import type { Writable } from "node:stream";
import type { TaskStatus } from "./status";

export type TaskRef = string | RegExp | Task;

export interface TaskConfig {
  name: string;
  cwd?: string;
  dependsOn?: TaskRef[];
  inputs?: string[];
  outputs?: string[];
  force?: boolean | (() => boolean | Promise<boolean>);
}

export type TaskAction = (options: ExecuteOptions) => Promise<TaskStatus>;

export interface ExecuteOptions {
  stdout?: Writable;
  stderr?: Writable;
  logger?: {
    info: (line: string) => void;
    error: (line: string) => void;
    prefix?: string;
  };
}

export class Task {
  readonly name: string;
  readonly cwd: string | undefined;
  readonly dependsOn: TaskRef[];
  readonly inputs: string[] | undefined;
  readonly outputs: string[] | undefined;
  private force: boolean | (() => boolean | Promise<boolean>) | undefined;
  private action: TaskAction;

  constructor(config: TaskConfig, action: TaskAction) {
    this.name = config.name;
    this.cwd = config.cwd;
    this.dependsOn = config.dependsOn ?? [];
    this.inputs = config.inputs;
    this.outputs = config.outputs;
    this.force = config.force;
    this.action = action;
  }

  async execute(options: ExecuteOptions = {}): Promise<TaskStatus> {
    return this.action(options);
  }

  async isForced(): Promise<boolean> {
    if (typeof this.force === "function") return Boolean(await this.force());
    return Boolean(this.force);
  }

  hasInputs(): boolean {
    return Boolean(this.inputs && this.inputs.length > 0);
  }

  hasOutputs(): boolean {
    return Boolean(this.outputs && this.outputs.length > 0);
  }
}
