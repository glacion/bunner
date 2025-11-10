#!/usr/bin/env bun

import { access } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import type { Namespace } from "#/lib/namespace";
import { type Task } from "#/lib/task";
import { buildPlan } from "#/lib/plan";

class CliError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

const createProgram = () =>
  new Command()
    .name("bunner")
    .description("A simple task runner")
    .version(process.env["VERSION"] || "0.0.0")
    .option("-f, --file <path>", "the bunner file to use", "bunner.ts")
    .option("-l, --list", "list all discovered tasks")
    .option("--dry-run", "print the execution plan without running any task")
    .option("-F, --force", "run all tasks even if cached outputs are up to date")
    .argument("[patterns...]", "regex patterns selecting tasks to run");

const isNamespace = (value: unknown): value is Namespace =>
  Boolean(value) && typeof (value as Namespace).collect === "function" && typeof (value as Namespace).select === "function";

const compilePattern = (pattern: string): Promise<RegExp> =>
  Promise.resolve(pattern)
    .then((value) => new RegExp(value))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Invalid regex "${pattern}": ${message}`);
    });

const loadNamespace = (filePath: string): Promise<Namespace> =>
  import(filePath)
    .then((module) => {
      if (!isNamespace(module.default)) {
        throw new CliError("default export should be a namespace");
      }
      return module.default;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Failed to load ${filePath}: ${message}`);
    });

const findNamespaceFile = async (start: string, target: string): Promise<string> => {
  const resolvedStart = path.resolve(start);
  const root = path.parse(resolvedStart).root;

  const search = async (current: string): Promise<string> => {
    const candidate = path.join(current, target);
    const exists = await access(candidate)
      .then(() => true)
      .catch(() => false);
    if (exists) return candidate;
    if (current === root) return path.join(resolvedStart, target);
    return search(path.dirname(current));
  };

  return search(resolvedStart);
};

const collectTasks = (namespace: Namespace): Task[] =>
  namespace
    .collect()
    .flatMap((ns: Namespace) => Object.values(ns.tasks))
    .sort((a: Task, b: Task) => a.fqn.localeCompare(b.fqn));

const listTasks = (namespace: Namespace) => {
  collectTasks(namespace).forEach((task) => {
    console.log(task.fqn);
  });
};

const selectTargets = (namespace: Namespace, patterns: RegExp[]): Task[] => {
  const targetMap = new Map<string, Task>();
  patterns
    .flatMap((pattern) => namespace.select(pattern))
    .forEach((task) => {
      targetMap.set(task.fqn, task);
    });
  return Array.from(targetMap.values());
};

const printPlan = (plan: Task[]) => {
  plan.forEach((task, index) => {
    console.log(`${index + 1}. ${task.fqn}`);
  });
};

const runTargets = async (targets: Task[], force = false): Promise<number> => {
  const codes = await Promise.all(targets.map((task) => task.spawn(process.stderr, process.stdout, force)));
  return codes.reduce((total, current) => total + current, 0);
};

const main = async (): Promise<number> => {
  const program = createProgram();
  await program.parseAsync(process.argv);

  const options = program.opts<{
    file: string;
    list?: boolean;
    dryRun?: boolean;
    force?: boolean;
  }>();

  const namespacePath = await findNamespaceFile(process.cwd(), options.file);
  const namespace = await loadNamespace(namespacePath);

  const patterns = program.args as string[];
  const hasPatterns = patterns.length > 0;

  if (!hasPatterns && !options.list) {
    if (options.dryRun) throw new CliError("--dry-run requires at least one task pattern");
    listTasks(namespace);
    return 0;
  }

  if (options.list) {
    listTasks(namespace);
  }

  if (!hasPatterns) {
    if (options.dryRun) throw new CliError("--dry-run requires at least one task pattern");
    return 0;
  }

  const regexes = await Promise.all(patterns.map((pattern) => compilePattern(pattern)));
  const targets = selectTargets(namespace, regexes);
  if (!targets.length) {
    const available = collectTasks(namespace);
    const lines = ["No tasks matched the provided patterns", "Available tasks:", ...available.map((task) => `  - ${task.fqn}`)];
    throw new CliError(lines.join("\n"));
  }

  if (options.dryRun) {
    printPlan(buildPlan(targets));
    return 0;
  }

  return runTargets(targets, Boolean(options.force));
};

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(exitCode);
  });
