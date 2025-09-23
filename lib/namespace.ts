import { Task, type TaskConfig } from "#/lib/task";

export interface NamespaceConfig {
  directory?: string;
  name: string;
  parent?: Namespace;
}

export class Namespace {
  children: Record<string, Namespace> = {};
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
    return namespace;
  }

  collect(namespaces: Namespace[] = []): Namespace[] {
    namespaces.push(this);
    Object.values(this.children).map((child) => child.collect(namespaces));
    return namespaces;
  }

  get fqn(): string {
    if (this.parent) return `${this.parent.fqn}:${this.name}`;
    return this.name;
  }

  get root(): Namespace {
    if (this.parent) return this.parent.root;
    return this;
  }

  select(pattern: RegExp, tasks: Task[] = []): Task[] {
    Object.values(this.children).map((child) => child.select(pattern, tasks));
    Object.values(this.tasks)
      .filter((task) => pattern.test(task.fqn))
      .map((task) => tasks.push(task));
    return tasks;
  }

  task(config: Omit<TaskConfig, "namespace">) {
    if (this.tasks[config.name]) throw new Error("another task with the same name exists");
    const task = new Task({ ...config, namespace: this });
    this.tasks[config.name] = task;
    return task;
  }
}
