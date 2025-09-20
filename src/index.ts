import path from "node:path";
import { Command } from "commander";
import type { Namespace } from "#/src/namespace";

const main = async () => {
  const app = new Command();
  await app
    .name("bunner")
    .description("A simple task runner")
    .version(process.env["VERSION"] || "0.0.0")
    .option("-f, --file <path>", "the bunner file to use", "bunner.ts")
    .argument("[tasks...]", "tasks to run")
    .parseAsync(process.argv);

  const module = await import(path.resolve(process.cwd(), app.opts()["file"]));
  if (!("select" in module.default)) throw new Error("default export should be a namespace");

  if (app.args) {
    const targets = app.args.flatMap((pattern: string) => module.default.select(new RegExp(pattern)));
    await Promise.all(targets.map((task) => task.spawn()));
  } else {
    // Default action: list all tasks
    const tasks = module.default.collect().flatMap((namespace: Namespace) => Object.values(namespace.tasks));
    console.table(tasks, ["fqdn", "description"]);
  }
};

main().catch(console.error);
