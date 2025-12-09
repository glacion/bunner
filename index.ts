#!/usr/bin/env bun

import path from "node:path";
import { Command } from "commander";
import { CacheStore, resolveLockPath } from "./lib/cache";
import { defaultConcurrency } from "./lib/concurrency";
import type { Graph } from "./lib/graph";
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

    const dag: Graph = (await import(path.resolve(process.cwd(), options.file))).default;
    if (!dag || typeof dag.list !== "function") throw new Error(`default export of ${options.file} must be a Graph`);
    const lockPath = resolveLockPath(process.cwd());
    const cache = options.force ? null : new CacheStore(lockPath);

    if (!cli.args.length) {
      dag.list().forEach((task: Task) => console.log(task.name));
      process.exit(1);
    }

    const targets = cli.args.flatMap((pattern) => dag.resolve(new RegExp(pattern)));

    if (options.dryRun) {
      console.log(dag.dot(targets));
      process.exit();
    }

    if (targets.length === 0) {
      console.error(`no tasks found for pattern ${cli.args.join(" ")}`);
      console.error(`\nAvailable tasks:`);
      dag.list().forEach((task: Task) => console.error(`- ${task.name}`));
      process.exit(1);
    }

    const runtime = new Runtime(dag, { cache, refreshCache: options.refreshCache, concurrency: options.concurrency ?? defaultConcurrency });
    const statuses = await runtime.run(targets);
    const summary = { failed: 0, skipped: 0, succeeded: 0 };
    for (const status of statuses.values()) {
      if (status === TaskStatus.FAIL) summary.failed++;
      else if (status === TaskStatus.SKIP) summary.skipped++;
      else if (status === TaskStatus.SUCCESS) summary.succeeded++;
    }

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
