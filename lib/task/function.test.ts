import { describe, expect, test } from "bun:test";
import { Namespace } from "#/lib/namespace";
import { FunctionTask } from "#/lib/task/function";

const createNamespace = (name = "namespace") => new Namespace({ name });

describe("FunctionTask", () => {
  test("executes provided callback", async () => {
    const namespace = createNamespace();
    let executed = false;
    const task = new FunctionTask({
      name: "func",
      namespace,
      run: () => {
        executed = true;
        return 0;
      },
    });

    const code = await task.spawn();
    expect(code).toBe(0);
    expect(executed).toBe(true);
  });

  test("respects explicit exit codes", async () => {
    const namespace = createNamespace();
    const task = new FunctionTask({
      name: "func",
      namespace,
      run: () => 5,
    });

    const code = await task.spawn();
    expect(code).toBe(5);
  });

  test("treats undefined returns as success", async () => {
    const namespace = createNamespace();
    const task = new FunctionTask({
      name: "void",
      namespace,
      run: async () => {
        await Promise.resolve();
        return undefined;
      },
    });

    const code = await task.spawn();
    expect(code).toBe(0);
  });
});
