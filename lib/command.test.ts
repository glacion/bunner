import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Command } from "./command";
import { TaskStatus } from "./status";

const writable = () => {
  const chunks: string[] = [];
  return {
    output: () => chunks.join(""),
    writable: new Writable({
      write(chunk, _, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    }),
  };
};

describe("command", () => {
  test("spawns the configured process and streams output", async () => {
    const stdout = writable();
    const stderr = writable();

    const command = new Command({ name: "build", directory: import.meta.dir }, "echo", "start");

    const status = await command.execute({ stderr: stderr.writable, stdout: stdout.writable });
    expect(status).toBe(TaskStatus.SUCCESS);
    expect(stdout.output()).toContain("start\n");
  });

  test("writes via provided logger with custom prefix", async () => {
    const logs: string[] = [];
    const command = new Command({ name: "logger", directory: import.meta.dir }, "echo", "hello");

    await command.execute({
      logger: {
        error: (line) => logs.push(`E:${line}`),
        info: (line) => logs.push(`I:${line}`),
        prefix: "[pref]",
      },
    });

    expect(logs.some((line) => line.includes("[pref]: hello"))).toBeTrue();
    expect(logs.every((line) => line.startsWith("I:"))).toBeTrue();
  });

  test("returns failure when the process exits non-zero", async () => {
    const command = new Command({ name: "fail", directory: import.meta.dir }, "false");
    const status = await command.execute();
    expect(status).toBe(TaskStatus.FAIL);
  });

  test("throws when no command is provided", () => {
    expect(() => new Command({ name: "empty", directory: import.meta.dir })).toThrow("command must not be empty");
  });
});
