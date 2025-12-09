import { type ExecuteState, TaskStatus } from "./status";
import type { Task } from "./task";

export interface StateContext {
  depsSkipped: boolean;
  forced: boolean;
  hasInputs: boolean;
  inputsUnchanged: boolean;
  outputsMissing: boolean;
  refreshCache: boolean;
  checksum: string | undefined;
  cache: { get(key: string): string | undefined; set(key: string, value: string): void } | undefined;
  task: Task;
}

type Transition = (state: ExecuteState, status?: TaskStatus) => Promise<TaskStatus>;

export const buildStateMachine = (ctx: StateContext, runner: () => Promise<TaskStatus>): Transition => {
  const transition: Transition = async (state, status) => {
    switch (state) {
      case "evaluate": {
        const skipForInputs = !ctx.refreshCache && ctx.inputsUnchanged && !ctx.forced && !ctx.outputsMissing;
        const skipForDeps = ctx.depsSkipped && !ctx.hasInputs && !ctx.forced && !ctx.outputsMissing;
        if (skipForInputs || skipForDeps) return transition("skip");
        return transition("run");
      }
      case "skip":
        return transition("cache", TaskStatus.SKIP);
      case "run": {
        return transition("cache", await runner());
      }
      case "cache": {
        if (status === undefined) return transition("done", TaskStatus.SKIP);
        if (status !== TaskStatus.FAIL && ctx.checksum && ctx.cache) ctx.cache.set(ctx.task.name, ctx.checksum);
        return transition("done", status);
      }
      case "done":
        return status ?? TaskStatus.SKIP;
    }
  };

  return transition;
};
