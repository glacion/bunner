import { describe, expect, test } from "bun:test";
import { TaskStatus } from "./status";
import { Task } from "./task";

describe("Task", () => {
  test("acts as a no-op metadependency when no action is provided", async () => {
    const task = new Task({ name: "group:backend" });
    const status = await task.execute();
    expect(status).toBe(TaskStatus.SUCCESS);
  });

  test("can still accept an explicit action", async () => {
    let called = false;
    const task = new Task(
      { name: "custom" },
      async () => {
        called = true;
        return TaskStatus.SUCCESS;
      }
    );
    const status = await task.execute();
    expect(status).toBe(TaskStatus.SUCCESS);
    expect(called).toBe(true);
  });
});
