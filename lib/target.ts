import { Node, type NodeAttributesObject } from "ts-graphviz";
import { type Color, random } from "./color";

export enum TargetStatus {
  FAIL,
  SUCCESS,
  SKIP,
}

export interface TargetConfig extends NodeAttributesObject {
  color?: Color;
  dependencies?: (string | RegExp | Target)[];
  directory?: string;
}

export class Target extends Node {
  [key: string]: unknown; // Needed to satisfy typescript
  private directory: string;
  protected color: Color;

  constructor(id: string, config: TargetConfig) {
    super(id, config);
    this.color = config.color ?? random();
    this.directory = config.directory ?? import.meta.dir;
  }

  execute(): Promise<TargetStatus> {
    return Promise.resolve(TargetStatus.SUCCESS);
  }

  get cwd(): string {
    if (this.directory) return this.directory;
    throw new Error("directory must be defined at least at root node");
  }
}
