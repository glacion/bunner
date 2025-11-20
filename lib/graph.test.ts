import { describe, expect, test } from "bun:test";
import { Graph } from "./graph";
import { Node } from "./node";

describe("graph", () => {
  test("renders direct dependency edges for provided nodes", () => {
    const root = new Node({ name: "root", directory: "/repo" });
    const install = new Node({ name: "install", parent: root });
    const testNode = new Node({ name: "test", parent: root, dependencies: [install] });

    const graph = new Graph({ nodes: [testNode] }).dot;

    expect(graph).toContain('"root:test" -> "root:install";');
    expect(graph).toContain('rankdir="LR";');
  });

  test("includes multiple nodes passed into the constructor", () => {
    const root = new Node({ name: "root", directory: "/repo" });
    const install = new Node({ name: "install", parent: root });
    const lint = new Node({ name: "lint", parent: root, dependencies: [install] });
    const testNode = new Node({ name: "test", parent: root, dependencies: [lint] });

    const graph = new Graph({ nodes: [lint, testNode] }).dot;

    expect(graph).toContain('"root:lint" -> "root:install";');
    expect(graph).toContain('"root:test" -> "root:lint";');
  });

  test("handles recursive dependencies", () => {
    const root = new Node({ name: "root", directory: "/repo" });
    const a = new Node({ name: "a", parent: root });
    const b = new Node({ name: "b", parent: root, dependencies: [a] });
    const c = new Node({ name: "c", parent: root, dependencies: [a] });
    const d = new Node({ name: "d", parent: root, dependencies: [b, c] });

    const graph = new Graph({ nodes: [d] }).dot;

    expect(graph).toContain('"root:d" -> "root:b";');
    expect(graph).toContain('"root:d" -> "root:c";');
    expect(graph).toContain('"root:b" -> "root:a";');
    expect(graph).toContain('"root:c" -> "root:a";');
  });
});
