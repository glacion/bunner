import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { styleText } from "node:util";
import { Command } from "#/lib/command";
import { NodeStatus } from "#/lib/node";

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
  test("spawns the configured process and streams prefixed output", async () => {
    const stdout = writable();
    const stderr = writable();
    const command = new Command({ color: "cyan", command: ["echo", "start"], name: "build" });

    await command.execute(stderr.writable, stdout.writable);
    expect(stdout.output()).toContain(`[${styleText("cyan", "build")}]: start\n`);
  });

  test("short circuits when a dependency fails", async () => {
    const stdout = writable();
    const stderr = writable();

    const dependency = new Command({ command: ["false"], name: "fail" });
    const command = new Command({ command: ["true"], dependencies: [dependency], name: "test" });

    const status = await command.execute(stderr.writable, stdout.writable);

    expect(status).toBe(NodeStatus.FAIL);
  });
});
