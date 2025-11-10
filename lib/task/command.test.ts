import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { Namespace } from "#/lib/namespace";
import { CommandTask } from "#/lib/task/command";

const createNamespace = (name = "namespace") => new Namespace({ name });

const createBufferedStream = () => {
  let buffer = "";
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        buffer += chunk.toString();
        callback?.();
      },
    }),
    read: () => buffer,
  };
};

const noopWritable = () =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback?.();
    },
  });

describe("CommandTask", () => {
  test("runs shell commands", async () => {
    const namespace = createNamespace();
    const task = new CommandTask({ name: "test", namespace, command: ["echo", "hello"] });
    const stream = noopWritable();
    const code = await task.spawn(stream, stream);
    expect(code).toBe(0);
  });

  test("streams stdout and stderr", async () => {
    const namespace = createNamespace();
    const task = new CommandTask({
      name: "test",
      namespace,
      command: ["bash", "-c", "echo hello && echo world >&2"],
    });

    const stdout = createBufferedStream();
    const stderr = createBufferedStream();

    const code = await task.spawn(stderr.stream, stdout.stream);
    expect(code).toBe(0);
    expect(stripVTControlCharacters(stderr.read()).trim()).toBe("[namespace:test]: world");
    expect(stripVTControlCharacters(stdout.read()).trim()).toBe("[namespace:test]: hello");
  });

  test("reruns commands on each spawn", async () => {
    const namespace = createNamespace();
    const temp = await mkdtemp("/tmp/");
    const file = `${temp}/runs.txt`;
    const task = new CommandTask({
      name: "repeat",
      namespace,
      command: ["bash", "-c", `echo run >> ${file}`],
    });

    await Promise.resolve()
      .then(async () => {
        await task.spawn();
        await task.spawn();

        const content = await readFile(file, "utf-8");
        expect(content.trim().split("\n")).toEqual(["run", "run"]);
      })
      .finally(() => rm(temp, { force: true, recursive: true }));
  });

  test("merges custom environment variables", async () => {
    const namespace = createNamespace();
    const task = new CommandTask({
      name: "env",
      namespace,
      environment: { CUSTOM_VALUE: "42" },
      command: ["bash", "-c", "echo $CUSTOM_VALUE"],
    });

    const stdout = createBufferedStream();
    const code = await task.spawn(noopWritable(), stdout.stream);
    expect(code).toBe(0);
    expect(stripVTControlCharacters(stdout.read()).trim()).toBe("[namespace:env]: 42");
  });
});
