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

  private isMetaTask(task: Task): boolean {
    return task.isGroup; // Use the new isGroup property
  }

  traverse(task: Task) {
    if (!task) return;
    if (this.hasVertex(task.name)) return;
    this.add(task);
    task.dependsOn.forEach((dep) => {
      if (dep instanceof Task) {
        this.traverse(dep);
      }
    });
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

    const uniqueEdges = new Set<string>();
    const allNonMetaNodes = new Set<string>();

    Array.from(reachable).forEach((task) => {
      if (!this.isMetaTask(task)) {
        allNonMetaNodes.add(task.name); // Add all reachable non-meta tasks as potential nodes

        const effectiveChildren = new Set<Task>();
        const initialQueue: Task[] = [...graph.getChildren(task.name).map(v => graph.getTask(v.id))];

        const collectChildren = (queue: Task[], visited: Set<Task>): void => {
          if (queue.length === 0) return;
          const [currentChild, ...rest] = queue;
          if (!currentChild || visited.has(currentChild)) {
             collectChildren(rest, visited);
             return;
          }
          visited.add(currentChild);

          if (this.isMetaTask(currentChild)) {
            const grandChildren = graph.getChildren(currentChild.name)
                 .map(v => graph.getTask(v.id));
            collectChildren([...rest, ...grandChildren], visited);
          } else {
            effectiveChildren.add(currentChild);
            collectChildren(rest, visited);
          }
        };

        collectChildren(initialQueue, new Set<Task>());

        effectiveChildren.forEach(effectiveChild => {
          const edge = `"${effectiveChild.name}" -> "${task.name}";`;
          uniqueEdges.add(edge);
          allNonMetaNodes.add(effectiveChild.name); // Ensure target of edge is also a node
        });
      }
    });

    const nonMetaTargets = targets.filter(task => !this.isMetaTask(task));

    // Generate node definitions for all non-meta nodes, marking targets as doublecircle
    const nodeDefinitions = Array.from(allNonMetaNodes).map(nodeName => {
        const isTarget = nonMetaTargets.some(target => target.name === nodeName);
        return `"${nodeName}"${isTarget ? " [shape=doublecircle]" : ""};`;
    }).join(" ");

    return `
      digraph bunner {
        rankdir="LR";
        ${nodeDefinitions}
        ${Array.from(uniqueEdges).join(" ")}
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
