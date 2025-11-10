import { describe, expect, test } from "bun:test";
import { Namespace } from "#/lib/namespace";
import { CommandTask } from "#/lib/task/command";
import { FunctionTask } from "#/lib/task/function";

describe("child", () => {
  test("should add a child namespace", () => {
    const parent = new Namespace({ name: "parent" });
    const child = new Namespace({ name: "child" });
    parent.child(child);
    expect(parent.children["child"]).toBe(child);
    expect(child.parent).toBe(parent);
  });
});

describe("collect", () => {
  test("should collect all namespaces", () => {
    const parent = new Namespace({ name: "parent" });
    const child = new Namespace({ name: "child" });
    parent.child(child);
    const namespaces = parent.collect();
    expect(namespaces).toContain(parent);
    expect(namespaces).toContain(child);
  });
});

describe("fqn", () => {
  test("should return the fully qualified name of the namespace", () => {
    const parent = new Namespace({ name: "parent" });
    const child = new Namespace({ name: "child" });
    parent.child(child);
    expect(child.fqn).toBe("parent:child");
  });
});

describe("resolve", () => {
  test("should resolve a task by name", () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = namespace.task({ name: "test", command: [] });
    expect(namespace.resolve("test")).toBe(task);
  });

  test("should resolve a task by name from another namespace", () => {
    const namespace = new Namespace({ name: "namespace" });
    const child1 = namespace.child(new Namespace({ name: "child1" }));
    const child2 = namespace.child(new Namespace({ name: "child2" }));
    const task1 = child1.task({ name: "test", command: [] });
    expect(child2.resolve("child1:test")).toBe(task1);
    expect(child2.resolve("namespace:child1:test")).toBe(task1);
  });

  test("should throw when resolution is ambiguous", () => {
    const namespace = new Namespace({ name: "namespace" });
    const child1 = namespace.child(new Namespace({ name: "child1" }));
    const child2 = namespace.child(new Namespace({ name: "child2" }));
    child1.task({ name: "deploy", command: [] });
    child2.task({ name: "deploy", command: [] });
    expect(() => namespace.resolve("deploy")).toThrow("ambiguous");
  });

  test("should throw when task cannot be resolved", () => {
    const namespace = new Namespace({ name: "namespace" });
    expect(() => namespace.resolve("missing")).toThrow("could not be resolved");
  });
});

describe("root", () => {
  test("should return the root namespace", () => {
    const parent = new Namespace({ name: "parent" });
    const child = parent.child(new Namespace({ name: "child" }));
    expect(child.root).toBe(parent);
  });
});

describe("select", () => {
  test("should select tasks by pattern", () => {
    const parent = new Namespace({ name: "parent" });
    const child = parent.child(new Namespace({ name: "child" }));
    const task1 = parent.task({ name: "test1", command: [] });
    const task2 = child.task({ name: "test2", command: [] });
    const tasks = parent.select(/^parent:test1$/);
    expect(tasks).toContain(task1);
    expect(tasks).not.toContain(task2);
  });
});

describe("task", () => {
  test("should add a task to the namespace", () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = namespace.task({ name: "test", command: [] });
    expect(namespace.tasks["test"]).toBe(task);
  });

  test("should throw when a task with the same name exists", () => {
    const namespace = new Namespace({ name: "namespace" });
    namespace.task({ name: "test", command: [] });
    expect(() => namespace.task({ name: "test", command: [] })).toThrow("another task with the same name exists");
  });

  test("should create a FunctionTask when run is provided", () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = namespace.task({ name: "fn", run: () => 0 });
    expect(task).toBeInstanceOf(FunctionTask);
  });

  test("should create a CommandTask when command is provided", () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = namespace.task({ name: "cmd", command: ["echo", "hi"] });
    expect(task).toBeInstanceOf(CommandTask);
  });

  test("should require a command or run handler", () => {
    const namespace = new Namespace({ name: "namespace" });
    expect(() => namespace.task({ name: "meta" })).toThrow("command");
  });

  test("should include newly added tasks in cached select results", () => {
    const namespace = new Namespace({ name: "namespace" });
    namespace.task({ name: "one", command: [] });

    const first = namespace.select(/namespace:one/);
    expect(first.map((task) => task.name)).toEqual(["one"]);

    namespace.task({ name: "two", command: [] });

    const second = namespace.select(/namespace:/);
    expect(second.map((task) => task.name).sort()).toEqual(["one", "two"]);
  });
});
