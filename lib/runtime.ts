import type { Cache } from "./cache";
import { CacheStore, resolveLockPath } from "./cache";
import { ConcurrencyLimiter, defaultConcurrency } from "./concurrency";
import { Fingerprint } from "./fingerprint";
import type { Graph } from "./graph";
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
    this.cache = options.cache ?? (needsCache ? new CacheStore(resolveLockPath(process.cwd())) : null);
    this.refreshCache = options.refreshCache ?? false;
  }

  async run(targets: Task[]): Promise<Map<Task, TaskStatus>> {
    const graph = this.graph;
    const needed = this.collectNeeded(targets, graph);
    const indegree = new Map<string, number>();
    needed.forEach((task) => indegree.set(task.name, graph.getParents(task.name).filter((p) => needed.has(graph.getTask(p.id))).length));

    const initialQueue: Task[] = Array.from(needed).filter((task) => (indegree.get(task.name) ?? 0) === 0);
    const statuses = await this.processQueue(initialQueue, indegree, needed, new Map<Task, TaskStatus>());

    if (this.cache) await this.cache.save();
    return statuses;
  }

  private async processQueue(queue: Task[], indegree: Map<string, number>, needed: Set<Task>, statuses: Map<Task, TaskStatus>): Promise<Map<Task, TaskStatus>> {
    if (queue.length === 0) {
      needed.forEach((task) => {
        if (!statuses.has(task)) statuses.set(task, TaskStatus.FAIL);
      });
      return statuses;
    }

    const [current, ...rest] = queue;
    if (!current) return this.processQueue(rest, indegree, needed, statuses);

    const parents = this.graph
      .getParents(current.name)
      .map((v) => this.graph.getTask(v.id))
      .filter((task) => needed.has(task));
    const blocked = parents.some((parent) => statuses.get(parent) === TaskStatus.FAIL);

    const status = blocked ? TaskStatus.FAIL : await this.execute(current, parents, statuses);
    const nextStatuses = new Map(statuses).set(current, status);

    const children = this.graph
      .getChildren(current.name)
      .map((childVertex) => this.graph.getTask(childVertex.id))
      .filter((child) => needed.has(child))
      .filter((child) => {
        const count = (indegree.get(child.name) ?? 0) - 1;
        indegree.set(child.name, count);
        return count === 0;
      });

    return this.processQueue([...rest, ...children], indegree, needed, nextStatuses);
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
    const fingerprint = hasFingerprint ? new Fingerprint({ cwd: task.cwd ?? process.cwd(), inputs: task.inputs, outputs: task.outputs }) : null;

    const depsSkipped = parents.length > 0 && parents.every((dep) => statuses.get(dep) === TaskStatus.SKIP);
    const forced = await task.isForced();
    const refresh = this.refreshCache;
    const outputsMissing = fingerprint ? await fingerprint.outputsMissing() : false;
    const checksum = fingerprint ? await fingerprint.inputHash() : undefined;
    const inputsUnchanged = checksum && this.cache ? this.cache.get(task.name) === checksum : false;
    const hasInputs = task.hasInputs();

    const machine = buildStateMachine(
      {
        cache: this.cache ?? undefined,
        checksum,
        depsSkipped,
        forced,
        hasInputs,
        inputsUnchanged,
        outputsMissing,
        refreshCache: refresh,
        task,
      },
      () => this.limiter.run(() => task.execute()),
    );

    return machine("evaluate");
  }
}
