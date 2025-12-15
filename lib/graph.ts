import { DiGraph, type VertexBody, type VertexDefinition } from "digraph-js";
import { digraph, toDot } from "ts-graphviz";
import type { Target } from "./target";

export interface TargetGraphConfig {
  name: string;
  directory: string;
}

export class TargetGraph extends DiGraph<VertexDefinition<Target>> {
  config: TargetGraphConfig;

  constructor(config: TargetGraphConfig) {
    super();
    this.config = config;
  }

  child(graph: TargetGraph) {
    const vertices = graph.traverseEager();
    this.addVertices(...vertices);

    vertices.forEach((vertex) => {
      vertex.adjacentTo.forEach((adjacent) => this.addEdge({ from: vertex.id, to: adjacent }));
    });
  }

  execute() {
    this.traverse().map((target) => target.body.execute());
  }

  dot() {
    return toDot(
      digraph("bunner", (graph) => {
        this.traverse().forEach((node) => {
          graph.node(node.id);
          node.adjacentTo.forEach((adjacent) => graph.edge([node.id, adjacent]));
        });
      }),
    );
  }
}
