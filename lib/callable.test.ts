import { describe, expect, test } from "bun:test";
import { Callable } from "./callable";
import { TaskStatus } from "./status";

describe("Callable", () => {
  test("runs the provided function", async () => {
    let called = false;
    const task = new Callable({
      name: "test-func",
      task: async () => {
        called = true;
        return TaskStatus.SUCCESS;
      },
    });

    const status = await task.execute();
    expect(status).toBe(TaskStatus.SUCCESS);
    expect(called).toBe(true);
  });

  test("can fail", async () => {
    const task = new Callable({
      name: "fail-func",
      task: async () => {
        return TaskStatus.FAIL;
      },
    });

    const status = await task.execute();
    expect(status).toBe(TaskStatus.FAIL);
  });
});
