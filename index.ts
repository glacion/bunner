#!/usr/bin/env bun

import path from "node:path";
import { Command } from "commander";
import { Graph } from "./lib/graph";
import { type Node, NodeStatus } from "./lib/node";

interface Options {
  dryRun?: boolean;
  file: string;
}

new Command()
  .name("bunner")
  .option("-f, --file <path>", "the bunner file to use", "bunner.ts")
  .option("-n, --dry-run", "print the execution graph without running commands")
  .argument("[args...]", "tasks to run")
  .parseAsync(process.argv)
  .then(async (program) => {
    const options = program.opts<Options>();
    const root: Node = (await import(path.resolve(process.cwd(), options.file))).default.root;
    if (!root?.resolve) throw new Error(`default export of ${options.file} must be a root node`);

    if (!program.args.length) {
      root.resolve(/./).forEach((node: Node) => console.log(node.fqn));
      process.exit(1);
    }

    const targets = program.args.flatMap((pattern) => root.resolve(new RegExp(pattern)));

    if (options.dryRun) {
      console.log(new Graph({ nodes: targets }).dot);
      process.exit();
    }

    if (targets.length === 0) {
      console.error(`no tasks found for pattern ${program.args.join(" ")}`);
      console.error(`\nAvailable tasks:`);
      root.resolve(/./).forEach((node: Node) => console.error(`- ${node.fqn}`));
      process.exit(1);
    }

    const results = await Promise.all(targets.map(async (target) => ({ target, status: await target.execute() })));
    return results.filter((result) => result.status === NodeStatus.FAIL);
  })
  .then((failed) => {
    if (failed.length > 0) {
      process.exitCode = 1;
      console.error("Failed tasks:");
      failed.forEach((task) => console.error(`- ${task.target.fqn}`));
    }
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
