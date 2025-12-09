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
    const graph = new Graph();
    const order: string[] = [];
    const a = graph.add(
      new Task({ name: "a" }, async () => {
        order.push("a");
        return TaskStatus.SUCCESS;
      }),
    );
    const b = graph.add(
      new Task({ name: "b", dependsOn: [a] }, async () => {
        order.push("b");
        return TaskStatus.SUCCESS;
      }),
    );

    const runtime = new Runtime(graph, { cache: null });
    const result = await runtime.run([b]);

    expect(result.get(a)).toBe(TaskStatus.SUCCESS);
    expect(result.get(b)).toBe(TaskStatus.SUCCESS);
    expect(order).toEqual(["a", "b"]);
  });

  test("skips tasks when inputs are unchanged", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bunner-runtime-"));
    const graph = new Graph(directory);
    const work = join(directory, "input.txt");
    writeFileSync(work, "hello");

    const build = graph.add(
      new Task(
        {
          name: "build",
          directory,
          inputs: ["input.txt"],
          outputs: ["output.txt"],
        },
        async () => {
          writeFileSync(join(directory, "output.txt"), "done");
          return TaskStatus.SUCCESS;
        },
      ),
    );

    const runtime = new Runtime(graph);
    const first = await runtime.run([build]);
    expect(first.get(build)).toBe(TaskStatus.SUCCESS);

    const second = await new Runtime(graph).run([build]);
    expect(second.get(build)).toBe(TaskStatus.SKIP);

    rmSync(directory, { recursive: true, force: true });
  });
});
