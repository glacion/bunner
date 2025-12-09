import { describe, expect, test } from "bun:test";
import { Graph } from "./graph";
import { Callable } from "./callable"; // Import Callable
import { Task } from "./task";
import { TaskStatus } from "./status";

const makeTask = (name: string, dependsOn: Task[] = []) =>
  new Callable({
    name,
    dependsOn,
    task: async () => TaskStatus.SUCCESS,
  });

describe("graph", () => {
  test("renders direct dependency edges for provided nodes", () => {
    const graph = new Graph();
    const install = graph.add(makeTask("install"));
    const testTask = graph.add(makeTask("test", [install]));

    const dot = graph.dot([testTask]);

    expect(dot).toContain('"test" -> "install";');
    expect(dot).toContain('"test" [shape=doublecircle];');
  });

  test("includes multiple nodes passed into the constructor", () => {
    const graph = new Graph();
    const install = graph.add(makeTask("install"));
    const lint = graph.add(makeTask("lint", [install]));
    const testTask = graph.add(makeTask("test", [lint]));

    const dot = graph.dot([lint, testTask]);

    expect(dot).toContain('"lint" -> "install";');
    expect(dot).toContain('"test" -> "lint";');
    expect(dot).toContain('"lint" [shape=doublecircle];');
    expect(dot).toContain('"test" [shape=doublecircle];');
  });

  test("handles recursive dependencies", () => {
    const graph = new Graph();
    const a = graph.add(makeTask("a"));
    const b = graph.add(makeTask("b", [a]));
    const c = graph.add(makeTask("c", [a]));
    const d = graph.add(makeTask("d", [b, c]));

    const dot = graph.dot([d]);

    expect(dot).toContain('"b" -> "a";');
    expect(dot).toContain('"c" -> "a";');
    expect(dot).toContain('"d" -> "b";');
    expect(dot).toContain('"d" -> "c";');
    expect(dot).toContain('"d" [shape=doublecircle];');
  });
});
