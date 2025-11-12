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
    if (this.children[child.name]) throw new Error("another child with the same name exists");
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
    const nodes = this.dependencies.flatMap((node) => this.resolve(node));
    const statuses = await Promise.all(nodes.map((node) => node.execute()));
    if (statuses.some((status) => status === NodeStatus.FAIL)) return NodeStatus.FAIL;
    else return NodeStatus.SUCCESS;
  }

  get fqn(): string {
    if (!this.parent) return this.name;
    return `${this.parent.fqn}:${this.name}`;
  }

  resolve(target: string | RegExp | Node): Node[] {
    if (target instanceof Node) return [target];
    if (target instanceof RegExp) return this.root.collect().filter((node) => target.test(node.fqn));
    const node = this.root.collect().find((node) => node.fqn === target);
    if (node) return [node];
    throw new Error("no nodes found");
  }

  private get root(): Node {
    if (this.parent) return this.parent.root;
    return this;
  }
}
