import { describe, expect, test } from "bun:test";
import { Graph } from "./graph";
import { Node } from "./node";

describe("graph", () => {
  test("renders direct dependency edges for provided nodes", () => {
    const root = new Node({ name: "root" });
    const install = new Node({ name: "install", parent: root });
    const testNode = new Node({ name: "test", parent: root, dependencies: [install] });

    const graph = new Graph({ nodes: [testNode] }).dot;

    expect(graph).toContain('"root:test" -> "root:install";');
    expect(graph).toContain('rankdir="LR";');
  });

  test("includes multiple nodes passed into the constructor", () => {
    const root = new Node({ name: "root" });
    const install = new Node({ name: "install", parent: root });
    const lint = new Node({ name: "lint", parent: root, dependencies: [install] });
    const testNode = new Node({ name: "test", parent: root, dependencies: [lint] });

    const graph = new Graph({ nodes: [lint, testNode] }).dot;

    expect(graph).toContain('"root:lint" -> "root:install";');
    expect(graph).toContain('"root:test" -> "root:lint";');
  });
});
