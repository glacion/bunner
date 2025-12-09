import { describe, expect, test } from "bun:test";
import { Graph } from "./graph";
import { TaskStatus } from "./status";
import { Task } from "./task";

const makeTask = (name: string, dependsOn: Task[] = []) => new Task({ name, dependsOn, cwd: "/repo" }, async () => TaskStatus.SUCCESS);

describe("graph", () => {
  test("renders direct dependency edges for provided nodes", () => {
    const dag = new Graph("/repo");
    const install = dag.add(makeTask("install"));
    const testTask = dag.add(makeTask("test", [install]));

    const graph = dag.dot([testTask]);

    expect(graph).toContain('"install" -> "test";');
    expect(graph).toContain('rankdir="LR";');
  });

  test("includes multiple nodes passed into the constructor", () => {
    const dag = new Graph("/repo");
    const install = dag.add(makeTask("install"));
    const lint = dag.add(makeTask("lint", [install]));
    const testTask = dag.add(makeTask("test", [lint]));

    const graph = dag.dot([lint, testTask]);

    expect(graph).toContain('"install" -> "lint";');
    expect(graph).toContain('"lint" -> "test";');
  });

  test("handles recursive dependencies", () => {
    const dag = new Graph("/repo");
    const a = dag.add(makeTask("a"));
    const b = dag.add(makeTask("b", [a]));
    const c = dag.add(makeTask("c", [a]));
    const d = dag.add(makeTask("d", [b, c]));

    const graph = dag.dot([d]);

    expect(graph).toContain('"a" -> "b";');
    expect(graph).toContain('"a" -> "c";');
    expect(graph).toContain('"b" -> "d";');
    expect(graph).toContain('"c" -> "d";');
  });
});
