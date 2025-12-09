import { describe, expect, test } from "bun:test";
import { Graph } from "../lib/graph";
import { Task } from "../lib/task";
import { Callable } from "../lib/callable";
import { TaskStatus } from "../lib/status";

describe("Graph dot representation with meta tasks", () => {
  test("omits meta tasks and bypasses them with direct edges", async () => {
    const graph = new Graph();

    const taskA = graph.add(new Callable({
      name: "task-a",
      task: async () => TaskStatus.SUCCESS
    }));

    const metaTask = graph.add(new Task({
      name: "meta-task",
      dependsOn: [taskA],
      isGroup: true, // Explicitly mark as group/meta task
    }));

    const taskB = graph.add(new Callable({
      name: "task-b",
      dependsOn: [metaTask],
      task: async () => TaskStatus.SUCCESS
    }));

    const dotOutput = graph.dot([taskB]);

    // Expect meta-task not to be present as a node definition or target
    expect(dotOutput).not.toContain('"meta-task" [shape=doublecircle];');

    // Expect direct edge from taskA to taskB, bypassing metaTask
    expect(dotOutput).toContain('"task-b" -> "task-a";');

    // Ensure the original meta-task edges are not present
    expect(dotOutput).not.toContain('"task-a" -> "meta-task";');
    expect(dotOutput).not.toContain('"meta-task" -> "task-b";');
    expect(dotOutput).not.toContain('"meta-task" -> "task-a";'); // Reversed check
    expect(dotOutput).not.toContain('"task-b" -> "meta-task";'); // Reversed check

    // Ensure concrete tasks are still present
    expect(dotOutput).toContain('"task-a"');
    expect(dotOutput).toContain('"task-b" [shape=doublecircle];');
  });

  test("handles multiple layers of meta tasks", async () => {
    const graph = new Graph();

    const taskA = graph.add(new Callable({
      name: "task-a",
      task: async () => TaskStatus.SUCCESS
    }));

    const metaTask1 = graph.add(new Task({
      name: "meta-task-1",
      dependsOn: [taskA],
      isGroup: true, // Explicitly mark as group/meta task
    }));

    const metaTask2 = graph.add(new Task({
      name: "meta-task-2",
      dependsOn: [metaTask1],
      isGroup: true, // Explicitly mark as group/meta task
    }));

    const taskB = graph.add(new Callable({
      name: "task-b",
      dependsOn: [metaTask2],
      task: async () => TaskStatus.SUCCESS
    }));

    const dotOutput = graph.dot([taskB]);

    expect(dotOutput).not.toContain('"meta-task-1"');
    expect(dotOutput).not.toContain('"meta-task-2"');
    expect(dotOutput).toContain('"task-b" -> "task-a";');
  });

  test("omits meta tasks that are targets", async () => {
    const graph = new Graph();

    const taskA = graph.add(new Callable({
      name: "task-a",
      task: async () => TaskStatus.SUCCESS
    }));

    const metaTask = graph.add(new Task({
      name: "meta-target",
      dependsOn: [taskA],
      isGroup: true, // Explicitly mark as group/meta task
    }));

    const dotOutput = graph.dot([metaTask]);

    expect(dotOutput).not.toContain('"meta-target" [shape=doublecircle];');
    expect(dotOutput).toContain('"task-a"'); // Still includes reachable concrete tasks
    expect(dotOutput).not.toContain('"task-a" -> "meta-target";');
  });
});
