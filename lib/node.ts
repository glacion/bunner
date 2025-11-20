import { type Color, random } from "./color";

export enum NodeStatus {
  FAIL,
  SUCCESS,
}

export interface NodeConfig {
  color?: Color;
  dependencies?: (string | RegExp | Node)[];
  directory?: string;
  name: string;
  parent?: Node;
}

export class Node {
  dependencies: (string | RegExp | Node)[];
  name: string;
  private children: Record<string, Node>;
  private directory: string | undefined;
  private parent: Node | undefined;
  protected color: Color;

  constructor(config: NodeConfig) {
    this.children = {};
    this.color = config.color ?? random();
    this.directory = config.directory;
    this.dependencies = config.dependencies ?? [];
    this.name = config.name;
    if (config.parent) config.parent.child(this);
  }

  child(child: Node): Node {
    child.parent = this;
    if (this.children[child.name]) throw new Error(`another child with the same name exists: ${child.name}`);
    this.children[child.name] = child;
    return child;
  }

  collect(): Node[] {
    return [...Object.values(this.children), ...Object.values(this.children).flatMap((child) => child.collect())];
  }

  get cwd(): string {
    if (this.directory) return this.directory;
    if (this.parent) return this.parent.cwd;
    throw new Error("directory must be defined at least at root node");
  }

  async execute(): Promise<NodeStatus> {
    for (const dependency of this.dependencies) {
      for (const node of this.resolve(dependency)) {
        const result = await node.execute();
        if (result === NodeStatus.FAIL) return NodeStatus.FAIL;
      }
    }
    return NodeStatus.SUCCESS;
  }

  get fqn(): string {
    if (!this.parent) return this.name;
    return `${this.parent.fqn}:${this.name}`;
  }

  resolve(target: string | RegExp | Node): Node[] {
    if (target instanceof Node) return [target];
    const allNodes = [this.root, ...this.root.collect()];
    if (target instanceof RegExp) return allNodes.filter((node) => target.test(node.fqn));
    const nodes = allNodes.filter((node) => node.fqn === target || node.fqn.endsWith(`:${target}`));
    if (nodes.length > 0) return nodes;
    throw new Error(`no nodes found for target ${target}`);
  }

  private get root(): Node {
    if (this.parent) return this.parent.root;
    return this;
  }
}
