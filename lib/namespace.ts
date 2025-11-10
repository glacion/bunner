import { Task, type TaskConfig } from "#/lib/task";
import { CommandTask } from "#/lib/task/command";
import { FunctionTask } from "#/lib/task/function";

const createTaskInstance = (config: TaskConfig): Task => {
  if (typeof config.run === "function") {
    return new FunctionTask({ ...config, run: config.run });
  }
  if (config.command) {
    return new CommandTask({ ...config, command: config.command });
  }
  throw new Error("tasks must specify either 'command' or 'run'");
};

export interface NamespaceConfig {
  directory?: string;
  name: string;
  parent?: Namespace;
}

export class Namespace {
  children: Record<string, Namespace> = {};
  private fqnIndex: Map<string, Task> = new Map();
  private selectCache: Map<string, Task[]> = new Map();
  directory: string | undefined;
  name: string;
  parent: Namespace | undefined;
  tasks: Record<string, Task> = {};

  constructor(config: NamespaceConfig) {
    this.directory = config.directory;
    this.name = config.name;
    this.parent = config.parent;
  }

  child(namespace: Namespace): Namespace {
    if (this.children[namespace.name]) throw new Error("another namespace with the same name exists");
    this.children[namespace.name] = namespace;
    namespace.parent = this;
    this.root.clearSelectCache();
    return namespace;
  }

  collect(namespaces: Namespace[] = []): Namespace[] {
    const collected = [this, ...Object.values(this.children).flatMap((child) => child.collect())];
    if (!namespaces.length) return collected;
    namespaces.push(...collected);
    return namespaces;
  }

  get fqn(): string {
    if (this.parent) return `${this.parent.fqn}:${this.name}`;
    return this.name;
  }

  private register(task: Task) {
    const fqn = task.fqn;
    const root = this.root;
    const existing = root.fqnIndex.get(fqn);
    if (existing && existing !== task) throw new Error(`another task with the FQN '${fqn}' already exists`);
    root.fqnIndex.set(fqn, task);
    root.clearSelectCache();
  }

  private clearSelectCache() {
    this.selectCache.clear();
    Object.values(this.children).forEach((child) => child.clearSelectCache());
  }

  private lookupMatchingTasks(identifier: string): Task[] {
    const root = this.root;
    if (root.fqnIndex.has(identifier)) return [root.fqnIndex.get(identifier)!];

    const tasks = Array.from(root.fqnIndex.values());
    const hasSeparator = identifier.includes(":");
    const suffix = hasSeparator ? identifier : `:${identifier}`;
    const matches = tasks.filter((task) => task.fqn.endsWith(suffix));
    return matches;
  }

  resolve(task: string | Task): Task {
    if (task instanceof Task) return task;
    const local = this.tasks[task];
    if (local) return local;

    const matches = this.lookupMatchingTasks(task);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      const fqnList = matches
        .map((match) => match.fqn)
        .sort()
        .join(", ");
      throw new Error(`task '${task}' is ambiguous; matches: ${fqnList}`);
    }

    if (this.parent) return this.parent.resolve(task);
    throw new Error(`task '${task}' could not be resolved`);
  }

  get root(): Namespace {
    if (this.parent) return this.parent.root;
    return this;
  }

  select(pattern: RegExp): Task[] {
    const key = `${pattern.source}/${pattern.flags}`;
    const cached = this.selectCache.get(key);
    if (cached) return [...cached];

    const traverse = (namespace: Namespace): Task[] => {
      const childMatches = Object.values(namespace.children).flatMap(traverse);
      const localMatches = Object.values(namespace.tasks).filter((task) => {
        pattern.lastIndex = 0;
        return pattern.test(task.fqn);
      });
      return [...childMatches, ...localMatches];
    };

    const results = traverse(this);
    this.selectCache.set(key, results);
    return [...results];
  }

  task(config: Omit<TaskConfig, "namespace">) {
    if (this.tasks[config.name]) throw new Error("another task with the same name exists");
    const task = createTaskInstance({ ...config, namespace: this });
    this.tasks[config.name] = task;
    this.register(task);
    return task;
  }
}
