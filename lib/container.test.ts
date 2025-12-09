import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Container } from "./container";
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

describe("Container", () => {
  test("runs a command in a container and streams output", async () => {
    const stdout = writable();
    const stderr = writable();

    const containerTask = new Container(
      { name: "alpine-echo", image: "alpine:latest" },
      "echo",
      "hello from alpine",
    );

    const status = await containerTask.execute({ stderr: stderr.writable, stdout: stdout.writable });
    expect(status).toBe(TaskStatus.SUCCESS);
    expect(stdout.output()).toContain("hello from alpine");
  }, 20_000); // Increased timeout for Docker operations

  test("returns failure when the container exits non-zero", async () => {
    const stdout = writable();
    const stderr = writable();

    const containerTask = new Container(
      { name: "alpine-fail", image: "alpine:latest" },
      "sh",
      "-c",
      "exit 1",
    );

    const status = await containerTask.execute({ stderr: stderr.writable, stdout: stdout.writable });
    expect(status).toBe(TaskStatus.FAIL);
  }, 20_000); // Increased timeout

  test("handles environment variables", async () => {
    const stdout = writable();
    const stderr = writable();

    const containerTask = new Container(
      { name: "alpine-env", image: "alpine:latest", environment: { MY_VAR: "test_value" } },
      "sh",
      "-c",
      "echo $MY_VAR",
    );

    const status = await containerTask.execute({ stderr: stderr.writable, stdout: stdout.writable });
    expect(status).toBe(TaskStatus.SUCCESS);
    expect(stdout.output()).toContain("test_value");
  }, 20_000); // Increased timeout

  test("throws when no image is provided", () => {
    // @ts-ignore - testing invalid config
    expect(() => new Container({ name: "no-image" }, "echo", "test")).toThrow("image must be specified for a Container task");
  });
});
