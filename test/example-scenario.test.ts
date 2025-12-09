import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Graph } from "../lib/graph";
import { Runtime } from "../lib/runtime";
import { TaskStatus } from "../lib/status";
import { Task } from "../lib/task";

const makeTask = (cwd: string, name: string, dependsOn: Task[] = [], inputs?: string[], outputs?: string[], write?: string) =>
  new Task({ name, cwd, dependsOn, inputs, outputs }, async () => {
    if (write) {
      mkdirSync(join(cwd, "artifacts"), { recursive: true });
      writeFileSync(join(cwd, "artifacts", `${name}.txt`), write);
    }
    return TaskStatus.SUCCESS;
  });

describe("realistic example flow", () => {
  test("install step feeds multiple services and caching skips unchanged tasks", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "bunner-example-"));
    const lock = join(cwd, "pnpm-lock.yaml");
    writeFileSync(lock, "lock");

    const graph = new Graph(cwd);
    const install = graph.add(makeTask(cwd, "install", [], ["pnpm-lock.yaml"], ["artifacts/install.txt"], "deps"));

    const svcACode = join(cwd, "service-a.ts");
    const svcBCode = join(cwd, "service-b.ts");
    writeFileSync(svcACode, "console.log('a');");
    writeFileSync(svcBCode, "console.log('b');");

    const buildA = graph.add(makeTask(cwd, "service-a:build", [install], ["pnpm-lock.yaml", "service-a.ts"], ["artifacts/service-a:build.txt"], "a"));
    const buildB = graph.add(makeTask(cwd, "service-b:build", [install], ["pnpm-lock.yaml", "service-b.ts"], ["artifacts/service-b:build.txt"], "b"));

    const runtime = new Runtime(graph);
    const first = await runtime.run([buildA, buildB]);
    expect(first.get(install)).toBe(TaskStatus.SUCCESS);
    expect(first.get(buildA)).toBe(TaskStatus.SUCCESS);
    expect(first.get(buildB)).toBe(TaskStatus.SUCCESS);

    const second = await new Runtime(graph).run([buildA, buildB]);
    expect(second.get(install)).toBe(TaskStatus.SKIP);
    expect(second.get(buildA)).toBe(TaskStatus.SKIP);
    expect(second.get(buildB)).toBe(TaskStatus.SKIP);

    writeFileSync(svcACode, "console.log('a changed');");
    const third = await new Runtime(graph).run([buildA, buildB]);
    expect(third.get(install)).toBe(TaskStatus.SKIP);
    expect(third.get(buildA)).toBe(TaskStatus.SUCCESS);
    expect(third.get(buildB)).toBe(TaskStatus.SKIP);

    rmSync(cwd, { recursive: true, force: true });
  });
});
