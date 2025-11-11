import { type Color, random } from "#/lib/color";

export enum NodeStatus {
  FAIL,
  SUCCESS,
}

export interface NodeConfig {
  color?: Color;
  dependencies?: (string | RegExp | Node)[];
  name: string;
  parent?: Node;
}

export class Node {
  children: Record<string, Node>;
  color: Color;
  dependencies: (string | RegExp | Node)[];
  parent: Node | undefined;
  name: string;

  constructor(config: NodeConfig) {
    this.children = {};
    this.color = config.color ?? random();
    this.dependencies = config.dependencies ?? [];
    this.name = config.name;
    if (config.parent) config.parent.child(this);
  }

  child(child: Node): Node {
    child.name = `${this.name}:${child.name}`;
    child.parent = this;
    if (this.root.children[child.name]) throw new Error("another child with the same name exists");
    this.root.children[child.name] = child;
    return child;
  }

  async execute(): Promise<NodeStatus> {
    const nodes = this.dependencies.flatMap((node) => this.resolve(node));
    const statuses = await Promise.all(nodes.map((node) => node.execute()));
    if (statuses.some((status) => status === NodeStatus.FAIL)) return NodeStatus.FAIL;
    else return NodeStatus.SUCCESS;
  }

  resolve(target: string | RegExp | Node): Node[] {
    if (target instanceof Node) return [target];
    if (target instanceof RegExp) {
      const nodes = Object.values(this.root.children)
        .filter((node) => target.test(node.name))
        .map((node) => this.root.children[node.name]!);
      if (nodes.length) return nodes;
    } else if (this.root.children[target]) return [this.root.children[target]];
    throw new Error("no nodes found");
  }

  get root(): Node {
    if (this.parent) return this.parent.root;
    return this;
  }
}
