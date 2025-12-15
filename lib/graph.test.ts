import { describe, expect, test } from "bun:test";
import type { VertexDefinition } from "digraph-js";
import { TargetGraph } from "./graph";
import type { Target } from "./target";

const vertex = (id: string, adjacentTo: string[] = []): VertexDefinition<{ body: Target }> => ({
  id,
  adjacentTo,
  body: { body: {} as Target },
});

describe("TargetGraph", () => {
  describe("dot", () => {
    test("converts the digraph into DOT with nodes and edges", () => {
      const graph = new TargetGraph();
      graph.addVertices(vertex("build", ["lint", "test"]), vertex("lint"), vertex("test"));

      expect(graph.dot()).toBe(
        [
          'digraph "bunner" {',
          '  "build";',
          '  "lint";',
          '  "test";',
          '  "build" -> "lint";',
          '  "build" -> "test";',
          "}",
        ].join("\n"),
      );
    });

    test("includes disconnected vertices", () => {
      const graph = new TargetGraph();
      graph.addVertices(vertex("solo"), vertex("paired", ["child"]), vertex("child"));

      const dot = graph.dot();

      expect(dot).toContain('  "solo";');
      expect(dot).toContain('  "paired" -> "child";');
    });
  });

  describe("child", () => {
    test("merges edges from the child graph", () => {
      const parent = new TargetGraph();
      parent.addVertices(vertex("existing"), vertex("dependency"));

      const child = new TargetGraph();
      child.addVertices(vertex("existing", ["dependency"]));

      parent.child(child);

      expect(parent.getChildren("existing").map(({ id }) => id)).toEqual(["dependency"]);
    });
  });
});
