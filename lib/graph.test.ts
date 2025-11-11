import { describe, expect, test } from "bun:test";
import { Graph } from "#/lib/graph";
import { Node, NodeStatus } from "#/lib/node";

class GraphNode extends Node {
  override async execute(): Promise<NodeStatus> {
    return NodeStatus.SUCCESS;
  }
}

const createRoot = () => new GraphNode({ name: "root", dependencies: [] });

describe("graph", () => {
  test("renders direct dependency edges for provided nodes", () => {
    const root = createRoot();
    const install = new GraphNode({ name: "install", parent: root, dependencies: [] });
    const testNode = new GraphNode({ name: "test", parent: root, dependencies: [install] });

    const graph = new Graph({ nodes: [testNode] }).dot;

    expect(graph).toContain('"root:test" -> "root:install";');
    expect(graph).toContain('rankdir="LR";');
  });

  test("includes multiple nodes passed into the constructor", () => {
    const root = createRoot();
    const install = new GraphNode({ name: "install", parent: root, dependencies: [] });
    const lint = new GraphNode({ name: "lint", parent: root, dependencies: [install] });
    const testNode = new GraphNode({ name: "test", parent: root, dependencies: [lint] });

    const graph = new Graph({ nodes: [lint, testNode] }).dot;

    expect(graph).toContain('"root:lint" -> "root:install";');
    expect(graph).toContain('"root:test" -> "root:lint";');
  });
});
