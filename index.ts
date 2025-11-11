#!/usr/bin/env bun

import path from "node:path";
import { Command as Node } from "commander";
import type { Node } from "#/lib/node";

const app = new Node();
await app
  .name("bunner")
  .description("A simple task runner")
  .version(process.env["VERSION"] || "0.0.0")
  .option("-f, --file <path>", "the bunner file to use", "bunner.ts")
  .argument("[tasks...]", "tasks to run")
  .parseAsync(process.argv);

const module = await import(path.resolve(process.cwd(), app.opts()["file"]));
if (!module.default.root) throw new Error("default export should be a node");

if (app.args.length) {
  const targets = app.args.flatMap((pattern: string) => module.default.root.resolve(new RegExp(pattern)));
  await Promise.all(
    targets.map((target) => {
      return target.execute();
    }),
  );
} else {
  // Default action: list all tasks
  //
  module.default.root
    .resolve(/.*/)
    .map((node: Node) => console.log(node.name));
}
