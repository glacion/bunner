#!/usr/bin/env bun

import path from "node:path";
import { Command } from "commander";
import { CacheStore } from "./lib/cache";
import { defaultConcurrency } from "./lib/concurrency";
import { Graph } from "./lib/graph";
import { Lock } from "./lib/lock";
import { Runtime } from "./lib/runtime";
import { TaskStatus } from "./lib/status";
import type { Task } from "./lib/task";

interface Options {
  concurrency?: number;
  dryRun?: boolean;
  file: string;
  force: boolean;
  refreshCache: boolean;
  verbose?: boolean;
}

const cli = new Command()
  .name("bunner")
  .option("-c, --concurrency <number>", "maximum number of tasks to run simultaneously", (value) => Number.parseInt(value, 10))
  .option("--force", "skip reading/writing bunner.lock", false)
  .option("--refresh-cache", "recompute input checksums into bunner.lock without running tasks", false)
  .option("-v, --verbose", "print a summary of task outcomes")
  .option("-f, --file <path>", "the bunner file to use", "bunner.ts")
  .option("-n, --dry-run", "print the execution graph without running commands")
  .argument("[args...]", "tasks to run");

cli
  .parseAsync(process.argv)
  .then(async () => {
    const options = cli.opts<Options>();
    if (!Number.isInteger(options.concurrency ?? defaultConcurrency) || (options.concurrency ?? defaultConcurrency) < 1) {
      throw new Error("concurrency must be a positive integer");
    }

    const export_ = (await import(path.resolve(process.cwd(), options.file))).default;
    const tasks: Task[] = Array.isArray(export_) ? export_ : [export_];
    
    // Validate all tasks
    if (tasks.length === 0 || tasks.some(t => !t || typeof t.name !== "string" || !Array.isArray(t.dependsOn))) {
       throw new Error(`default export of ${options.file} must be a Task or Task[] (checking for .name and .dependsOn)`);
    }

    const graph = new Graph(process.cwd());
    tasks.forEach(task => graph.traverse(task));

    const lock = new Lock({ directory: process.cwd() });
    const cache = options.force ? null : new CacheStore(lock);

    if (!cli.args.length) {
      graph.list().forEach((task: Task) => console.log(task.name));
      process.exit(1);
    }

    const targets = cli.args.flatMap((pattern) => graph.resolve(new RegExp(pattern)));

    if (options.dryRun) {
      console.log(graph.dot(targets));
      process.exit();
    }

    if (targets.length === 0) {
      console.error(`no tasks found for pattern ${cli.args.join(" ")}`);
      console.error(`\nAvailable tasks:`);
      graph.list().forEach((task: Task) => console.error(`- ${task.name}`));
      process.exit(1);
    }

    const runtime = new Runtime(graph, { cache, refreshCache: options.refreshCache, concurrency: options.concurrency ?? defaultConcurrency });
    const statuses = await runtime.run(targets);
    const summary = Array.from(statuses.values()).reduce(
      (acc, status) => {
        if (status === TaskStatus.FAIL) acc.failed++;
        else if (status === TaskStatus.SKIP) acc.skipped++;
        else if (status === TaskStatus.SUCCESS) acc.succeeded++;
        return acc;
      },
      { failed: 0, skipped: 0, succeeded: 0 },
    );

    const failed = Array.from(statuses.entries())
      .filter(([, status]) => status === TaskStatus.FAIL)
      .map(([task]) => task);
    const skipped = Array.from(statuses.entries())
      .filter(([, status]) => status === TaskStatus.SKIP)
      .map(([task]) => task)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (options.verbose) {
      console.error(`Summary: ${summary.succeeded} success, ${summary.skipped} skipped, ${summary.failed} failed`);
    }
    if (skipped.length > 0) {
      console.error("Skipped tasks:");
      skipped.forEach((task) => console.error(`- ${task.name}`));
    }

    if (failed.length > 0) {
      process.exitCode = 1;
      console.error("Failed tasks:");
      failed.forEach((task) => console.error(`- ${task.name}`));
    }
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
