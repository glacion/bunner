import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Graph } from "./graph";
import { Runtime } from "./runtime";
import { TaskStatus } from "./status";
import { Task } from "./task";

describe("runtime", () => {
  test("runs dependencies before dependents", async () => {
    const dag = new Graph();
    const order: string[] = [];
    const a = dag.add(
      new Task({ name: "a" }, async () => {
        order.push("a");
        return TaskStatus.SUCCESS;
      }),
    );
    const b = dag.add(
      new Task({ name: "b", dependsOn: [a] }, async () => {
        order.push("b");
        return TaskStatus.SUCCESS;
      }),
    );

    const runtime = new Runtime(dag, { cache: null });
    const result = await runtime.run([b]);

    expect(result.get(a)).toBe(TaskStatus.SUCCESS);
    expect(result.get(b)).toBe(TaskStatus.SUCCESS);
    expect(order).toEqual(["a", "b"]);
  });

  test("skips tasks when inputs are unchanged", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "bunner-runtime-"));
    const dag = new Graph(cwd);
    const work = join(cwd, "input.txt");
    writeFileSync(work, "hello");

    const build = dag.add(
      new Task(
        {
          name: "build",
          cwd,
          inputs: ["input.txt"],
          outputs: ["output.txt"],
        },
        async () => {
          writeFileSync(join(cwd, "output.txt"), "done");
          return TaskStatus.SUCCESS;
        },
      ),
    );

    const runtime = new Runtime(dag);
    const first = await runtime.run([build]);
    expect(first.get(build)).toBe(TaskStatus.SUCCESS);

    const second = await new Runtime(dag).run([build]);
    expect(second.get(build)).toBe(TaskStatus.SKIP);

    rmSync(cwd, { recursive: true, force: true });
  });
});
