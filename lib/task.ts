import { TaskStatus } from "./status";
import type { Writable } from "node:stream";

export type TaskRef = string | RegExp | Task;

export interface TaskConfig {
  name: string;
  directory?: string;
  dependsOn?: TaskRef[];
  inputs?: string[];
  outputs?: string[];
  force?: boolean | (() => boolean | Promise<boolean>);
  isGroup?: boolean; // New property
}

export type Action = (options: ExecuteConfig) => Promise<TaskStatus>;

export interface ExecuteConfig {
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
  readonly directory: string | undefined;
  readonly dependsOn: TaskRef[];
  readonly inputs: string[] | undefined;
  readonly outputs: string[] | undefined;
  readonly isGroup: boolean; // New property
  private force: boolean | (() => boolean | Promise<boolean>) | undefined;
  private action: Action;

  constructor(config: TaskConfig, action?: Action) {
    this.name = config.name;
    this.directory = config.directory;
    this.dependsOn = config.dependsOn ?? [];
    this.inputs = config.inputs;
    this.outputs = config.outputs;
    this.force = config.force;
    this.isGroup = config.isGroup ?? false; // Initialize new property
    this.action = action ?? (async () => TaskStatus.SUCCESS);
  }

  async execute(options: ExecuteConfig = {}): Promise<TaskStatus> {
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
