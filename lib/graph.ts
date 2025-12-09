import { DiGraph, type VertexDefinition } from "digraph-js";
import { Task, type TaskRef } from "./task";

type TaskVertex = VertexDefinition<{ task: Task }>;

export class Graph extends DiGraph<TaskVertex> {
  readonly cwd: string | undefined;

  constructor(cwd?: string) {
    super();
    this.cwd = cwd;
  }

  add(task: Task): Task {
    if (this.hasVertex(task.name)) throw new Error(`task already exists: ${task.name}`);
    this.addVertex({ id: task.name, adjacentTo: [], body: { task } });
    return task;
  }

  list(): Task[] {
    return Object.values(this.toDict()).map((vertex) => vertex.body.task);
  }

  getTask(name: string): Task {
    const task = this.toDict()[name]?.body.task;
    if (!task) throw new Error(`task not found: ${name}`);
    return task;
  }

  resolve(ref: TaskRef): Task[] {
    if (ref instanceof Task) return [ref];
    if (ref instanceof RegExp) return this.list().filter((task) => ref.test(task.name));
    return [this.getTask(ref)];
  }

  build(): Graph {
    const built = new Graph(this.cwd);
    const tasks = this.list();
    tasks.forEach((task) => built.add(task));
    tasks.forEach((task) => task.dependsOn.forEach((ref) => built.resolve(ref).forEach((dep) => built.addEdge({ from: dep.name, to: task.name }))));
    return built;
  }

  dot(targets: Task[]): string {
    const graph = this.build();
    const reachable = collect(graph, targets);
    const edges = Array.from(reachable).flatMap((task) => graph.getChildren(task.name).map((child) => `"${task.name}" -> "${child.id}";`));

    return `
      digraph bunner {
        rankdir="LR";
        ${targets.map((task) => `"${task.name}" [shape=doublecircle];`).join(" ")}
        ${new Set(edges).keys().toArray().join(" ")}
      }
    `;
  }
}

const collect = (graph: Graph, targets: Task[]): Set<Task> => {
  const visit = (stack: Task[], visited: Set<Task>): Set<Task> => {
    if (stack.length === 0) return visited;
    const [task, ...rest] = stack;
    if (!task || visited.has(task)) return visit(rest, visited);
    const parents = graph.getParents(task.name).map((parent) => graph.getTask(parent.id));
    return visit([...rest, ...parents], new Set([...visited, task]));
  };

  return visit([...targets], new Set<Task>());
};
