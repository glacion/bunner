import type { Cache } from "./cache";
import { CacheStore } from "./cache";
import { ConcurrencyLimiter, defaultConcurrency } from "./concurrency";
import { Fingerprint } from "./fingerprint";
import { Graph } from "./graph";
import { Lock } from "./lock";
import { buildStateMachine } from "./state";
import { TaskStatus } from "./status";
import type { Task } from "./task";

export interface RuntimeOptions {
  concurrency?: number;
  refreshCache?: boolean;
  cache?: Cache | null;
  limiter?: ConcurrencyLimiter;
}

export class Runtime {
  private graph: Graph;
  private limiter: ConcurrencyLimiter;
  private cache: Cache | null;
  readonly refreshCache: boolean;

  constructor(graph: Graph, options: RuntimeOptions = {}) {
    this.graph = graph.build();
    this.limiter = options.limiter ?? new ConcurrencyLimiter(options.concurrency ?? defaultConcurrency);
    const needsCache = options.cache !== undefined ? options.cache !== null : this.graph.list().some((task) => task.hasInputs());
    const lock = new Lock({ directory: process.cwd() });
    this.cache = options.cache ?? (needsCache ? new CacheStore(lock) : null);
    this.refreshCache = options.refreshCache ?? false;
  }

  async run(targets: Task[]): Promise<Map<Task, TaskStatus>> {
    const needed = this.collectNeeded(targets, this.graph);
    const plan = this.createSubgraph(needed);
    const indegree = new Map<string, number>();

    plan.list().forEach((task) => {
      indegree.set(task.name, plan.getParents(task.name).length);
    });

    const initialQueue: Task[] = plan.list().filter((task) => (indegree.get(task.name) ?? 0) === 0);
    const statuses = await this.processQueue(initialQueue, indegree, plan, new Map<Task, TaskStatus>());

    if (this.cache) await this.cache.save();
    return statuses;
  }

  private async processQueue(queue: Task[], indegree: Map<string, number>, graph: Graph, statuses: Map<Task, TaskStatus>): Promise<Map<Task, TaskStatus>> {
    if (queue.length === 0) {
      graph.list().forEach((task) => {
        if (!statuses.has(task)) statuses.set(task, TaskStatus.FAIL);
      });
      return statuses;
    }

    const [current, ...rest] = queue;
    if (!current) return this.processQueue(rest, indegree, graph, statuses);

    const parents = graph.getParents(current.name).map((v) => graph.getTask(v.id));
    const blocked = parents.some((parent) => statuses.get(parent) === TaskStatus.FAIL);

    const status = blocked ? TaskStatus.FAIL : await this.execute(current, parents, statuses);
    const nextStatuses = new Map(statuses).set(current, status);

    const children = graph
      .getChildren(current.name)
      .map((childVertex) => graph.getTask(childVertex.id))
      .filter((child) => {
        const count = (indegree.get(child.name) ?? 0) - 1;
        indegree.set(child.name, count);
        return count === 0;
      });

    return this.processQueue([...rest, ...children], indegree, graph, nextStatuses);
  }

  private createSubgraph(tasks: Set<Task>): Graph {
    const subgraph = new Graph(this.graph.cwd);
    tasks.forEach((task) => subgraph.add(task));

    tasks.forEach((task) => {
      this.graph.getParents(task.name).forEach((parentVertex) => {
        const parent = this.graph.getTask(parentVertex.id);
        if (tasks.has(parent)) {
          subgraph.addEdge({ from: parent.name, to: task.name });
        }
      });
    });
    return subgraph;
  }

  private collectNeeded(targets: Task[], graph: Graph): Set<Task> {
    const visit = (stack: Task[], seen: Set<Task>): Set<Task> => {
      if (stack.length === 0) return seen;
      const [task, ...rest] = stack;
      if (!task || seen.has(task)) return visit(rest, seen);
      const parents = graph.getParents(task.name).map((vertex) => graph.getTask(vertex.id));
      return visit([...rest, ...parents], new Set([...seen, task]));
    };

    return visit([...targets], new Set<Task>());
  }

  private async execute(task: Task, parents: Task[], statuses: Map<Task, TaskStatus>): Promise<TaskStatus> {
    const hasFingerprint = task.hasInputs() || task.hasOutputs();
    const fingerprint = hasFingerprint ? new Fingerprint({ cwd: task.directory ?? process.cwd(), inputs: task.inputs, outputs: task.outputs }) : null;

    const depsSkipped = parents.length > 0 && parents.every((dep) => statuses.get(dep) === TaskStatus.SKIP);
    const forced = await task.isForced();
    const refresh = this.refreshCache;
    const outputsMissing = fingerprint ? await fingerprint.outputsMissing() : false;
    const checksum = fingerprint ? await fingerprint.inputHash() : undefined;
    const inputsUnchanged = checksum && this.cache ? this.cache.get(task.name) === checksum : false;
    const hasInputs = task.hasInputs();

    const machine = buildStateMachine(
      {
        shouldSkip: (!refresh && inputsUnchanged && !forced && !outputsMissing) || (depsSkipped && !hasInputs && !forced && !outputsMissing),
        updateCache: () => {
          if (checksum && this.cache) this.cache.set(task.name, checksum);
        },
      },
      () => this.limiter.run(() => task.execute()),
    );

    return machine("evaluate");
  }
}
