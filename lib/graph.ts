import type { Node } from "./node";

export interface GraphConfig {
  nodes: Node[];
}

export class Graph {
  dot: string;

  constructor(config: GraphConfig) {
    const edges = this.collect(config.nodes)
      .flatMap((from) => from.dependencies?.map((to) => ({ from, to: from.resolve(to)[0]! })) ?? [])
      .map((edge) => `"${edge.from.fqn}" -> "${edge.to.fqn}";`);

    this.dot = `
      digraph bunner {
        rankdir="LR";
        ${config.nodes.map((node) => `"${node.fqn}" [shape=doublecircle];`).join(" ")}
        ${new Set(edges).keys().toArray().join(" ")}
      }
    `;
  }

  private collect(nodes: Node[]): Node[] {
    if (nodes.length === 0) return nodes;
    const dependencies = nodes.flatMap((node) => node.dependencies.flatMap((dependency) => node.resolve(dependency)));
    return [...nodes, ...this.collect(dependencies)];
  }
}
