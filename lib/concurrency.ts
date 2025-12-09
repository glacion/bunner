import { availableParallelism } from "node:os";
import limitFactory from "promise-limit";

export const defaultConcurrency = Math.max(1, availableParallelism() ?? 1);

export class ConcurrencyLimiter {
  readonly limit: number;
  private limiter: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("concurrency must be at least 1");
    this.limit = limit;
    this.limiter = limitFactory(limit);
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    return this.limiter(task);
  }
}
