#!/usr/bin/env bun

import path from "node:path";
import { Command } from "commander";
import { Graph } from "./lib/graph";
import { type Node, NodeStatus } from "./lib/node";

interface Options {
  file: string;
  dryRun?: boolean;
}

const program = await new Command()
  .name("bunner")
  .option("-f, --file <path>", "the bunner file to use", "bunner.ts")
  .option("-n, --dry-run", "print the execution graph without running commands")
  .argument("[args...]", "tasks to run")
  .parseAsync(process.argv);

const options = program.opts<Options>();

const module = await import(path.resolve(process.cwd(), options.file));
if (!module.default.root?.resolve) throw new Error("default export must be a root node");

if (!program.args.length) module.default.root.resolve(/./).forEach((node: Node) => console.log(node.fqn));
else {
  const targets = program.args.flatMap((pattern) => module.default.root.resolve(new RegExp(pattern)));
  if (options.dryRun) console.log(new Graph({ nodes: targets }).dot);
  else {
    const statuses: NodeStatus[] = await Promise.all(targets.map((target) => target.execute()));
    if (statuses.some((status) => status === NodeStatus.FAIL)) process.exit(1);
    else process.exit(0);
  }
}
