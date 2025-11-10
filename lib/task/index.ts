import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { getSignature, setSignature } from "#/lib/cache";
import { type Color, random } from "#/lib/color";
import type { Namespace } from "#/lib/namespace";

type DependencyRef = string | Task | RegExp;

export interface TaskConfig {
  color?: Color;
  command?: string[];
  dependencies?: DependencyRef[];
  directory?: string;
  environment?: Record<string, string>;
  force?: boolean;
  name: string;
  namespace: Namespace;
  outputs?: string[];
  run?: () => number | void | Promise<number | void>;
  sources?: string[];
}

export abstract class Task {
  protected color: Color;
  protected dependencies: DependencyRef[];
  protected directory: string | undefined;
  protected environment: Record<string, string> | undefined;
  protected outputs: string[] | undefined;
  name: string;
  protected namespace: Namespace;
  protected sources: string[] | undefined;
  private forceRunByDefault: boolean;
  private resolved: Task[] | undefined;

  constructor(config: TaskConfig) {
    this.color = config.color ?? random();
    this.dependencies = config.dependencies ?? [];
    this.directory = config.directory;
    this.environment = config.environment;
    this.outputs = config.outputs;
    this.name = config.name;
    this.namespace = config.namespace;
    this.sources = config.sources;
    this.forceRunByDefault = config.force ?? false;
  }

  protected get workingDirectory(): string {
    return this.directory ?? this.namespace.directory ?? process.cwd();
  }

  get fqn(): string {
    return `${this.namespace.fqn}:${this.name}`;
  }

  resolve(): Task[] {
    if (!this.dependencies.length) return [];
    if (!this.resolved) {
      const addUnique = (tasks: Task[], task: Task) => (tasks.some((existing) => existing.fqn === task.fqn) ? tasks : [...tasks, task]);

      const toTasks = (dependency: DependencyRef): Task[] => {
        if (dependency instanceof Task) return [dependency];
        if (dependency instanceof RegExp) {
          const matches = this.namespace.select(dependency).sort((a, b) => a.fqn.localeCompare(b.fqn));
          if (!matches.length) throw new Error(`dependency pattern ${dependency} matched no tasks`);
          return matches;
        }
        return [this.namespace.resolve(dependency)];
      };

      this.resolved = this.dependencies.reduce<Task[]>((acc, dependency) => toTasks(dependency).reduce(addUnique, acc), []);
    }
    return this.resolved;
  }

  protected resolveFile(file: string): string {
    if (path.isAbsolute(file)) return file;
    return path.resolve(this.workingDirectory, file);
  }

  private async computeSignature(): Promise<string | undefined> {
    if (!this.sources?.length) return undefined;
    const hash = createHash("sha256");

    const processFile = async (label: string, file: string) => {
      const absolute = this.resolveFile(file);
      const contents = await readFile(absolute);
      hash.update(label);
      hash.update(absolute);
      hash.update(contents);
      return true;
    };

    const results = await Promise.all(this.sources.map((file) => processFile("S", file)));
    if (results.includes(false)) return undefined;
    return hash.digest("hex");
  }

  private async isUpToDate(force: boolean): Promise<boolean> {
    if (force) return false;
    const signature = await this.computeSignature();
    if (!signature) return false;
    const cached = await getSignature(this.fqn);
    if (cached !== signature) return false;
    if (await this.outputsMissing()) return false;
    return true;
  }

  private async outputsMissing(): Promise<boolean> {
    if (!this.outputs?.length) return false;
    const checks = await Promise.all(
      this.outputs.map((output) =>
        stat(this.resolveFile(output))
          .then(() => true)
          .catch(() => false),
      ),
    );
    return checks.includes(false);
  }

  private async recordSignature() {
    const signature = await this.computeSignature();
    if (!signature) return;
    await setSignature(this.fqn, signature);
  }

  async spawn(stderr: Writable = process.stderr, stdout: Writable = process.stdout, force = this.forceRunByDefault): Promise<number> {
    return this.execute(stderr, stdout, new Set<string>(), force);
  }

  private async execute(stderr: Writable, stdout: Writable, visiting: Set<string>, force: boolean): Promise<number> {
    if (visiting.has(this.fqn)) throw new Error(`cycle detected involving ${this.fqn}`);
    visiting.add(this.fqn);

    const resolveDependencies = () =>
      this.resolve().reduce<Promise<number>>(
        (previous, dependency) => previous.then((code) => (code !== 0 ? code : dependency.execute(stderr, stdout, visiting, force))),
        Promise.resolve(0),
      );

    const driveSelf = () =>
      this.isUpToDate(force)
        .then((upToDate) => (upToDate ? 0 : this.runTask(stderr, stdout)))
        .then((result) => (result === 0 ? this.recordSignature().then(() => result) : result));

    return resolveDependencies()
      .then((code) => (code !== 0 ? code : driveSelf()))
      .finally(() => {
        visiting.delete(this.fqn);
      });
  }

  protected abstract runTask(stderr: Writable, stdout: Writable): Promise<number>;
}
