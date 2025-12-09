import { describe, expect, test } from "bun:test";
import { Graph } from "../lib/graph";
import { Runtime } from "../lib/runtime";
import { TaskStatus } from "../lib/status";
import { Task } from "../lib/task";
import { Callable } from "../lib/callable";

describe("Metadependency", () => {
  test("runs dependencies of a no-op task", async () => {
    const graph = new Graph();
    const actions: string[] = [];

    const taskA = graph.add(new Callable({
      name: "task-a",
      task: async () => {
        actions.push("a");
        return TaskStatus.SUCCESS;
      }
    }));

    const taskB = graph.add(new Callable({
      name: "task-b",
      task: async () => {
        actions.push("b");
        return TaskStatus.SUCCESS;
      }
    }));

    // Metadependency: "all" depends on "task-a" and "task-b"
    const all = graph.add(new Task({ name: "all", dependsOn: [taskA, taskB] }));

    const runtime = new Runtime(graph);
    const statuses = await runtime.run([all]);

    expect(statuses.get(taskA)).toBe(TaskStatus.SUCCESS);
    expect(statuses.get(taskB)).toBe(TaskStatus.SUCCESS);
    expect(statuses.get(all)).toBe(TaskStatus.SUCCESS);
    expect(actions).toContain("a");
    expect(actions).toContain("b");
    expect(actions.length).toBe(2);
  });
});
