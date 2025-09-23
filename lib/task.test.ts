import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { Namespace } from "#/lib/namespace";
import { Task } from "#/lib/task";

describe("fqn", () => {
  test("should return the fully qualified name of the task", () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = new Task({ name: "test", namespace: namespace });
    expect(task.fqn).toBe("namespace:test");
  });

  test("should return the fully qualified name of the task with nested namespaces", () => {
    const parent = new Namespace({ name: "parent" });
    const child = new Namespace({ name: "child" });
    parent.child(child);
    const task = child.task({ name: "task" });
    expect(task.fqn).toBe("parent:child:task");
  });
});

describe("spawn", () => {
  test("should spawn a command", async () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = new Task({ name: "test", namespace: namespace, command: ["echo", "hello"] });

    const stream = new Writable({ write: () => {} });
    const code = await task.spawn(stream, stream);
    expect(code).toBe(0);
  });

  test("should stream stdout and stderr", async () => {
    const namespace = new Namespace({ name: "namespace" });
    const task = new Task({
      name: "test",
      namespace: namespace,
      command: ["bash", "-c", "echo hello && echo world >&2"],
    });

    let stdout = "";
    const stdoutStream = new Writable({
      write: (chunk) => {
        stdout += chunk;
      },
    });

    let stderr = "";
    const stderrStream = new Writable({
      write(chunk, _, callback) {
        stderr += chunk.toString();
        callback();
      },
    });

    const code = await task.spawn(stderrStream, stdoutStream);
    expect(code).toBe(0);
    expect(stripVTControlCharacters(stderr).trim()).toBe("[namespace:test]: world");
    expect(stripVTControlCharacters(stdout).trim()).toBe("[namespace:test]: hello");
  });

  test("should execute tasks in dependency chain order", async () => {
    const namespace = new Namespace({ name: "namespace" });
    const temp = await mkdtemp("/tmp/");
    const file = `${temp}/bunner.txt`;
    const a = namespace.task({ name: "a", command: ["bash", "-c", `echo a >> ${file}`] });
    const b = namespace.task({ name: "b", command: ["bash", "-c", `echo b >> ${file}`], dependencies: [a] });
    const c = namespace.task({ name: "c", command: ["bash", "-c", `echo c >> ${file}`], dependencies: [b] });

    await c.spawn();
    await b.spawn();
    await a.spawn();

    const content = await readFile(file, "utf-8");
    expect(content).toBe("a\nb\nc\n");

    await rm(temp, { force: true, recursive: true });
  });
});
