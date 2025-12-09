import { type ExecuteState, TaskStatus } from "./status";

export interface StateContext {
  shouldSkip: boolean;
  updateCache: () => void;
}

type Transition = (state: ExecuteState, status?: TaskStatus) => Promise<TaskStatus>;

export const buildStateMachine = (ctx: StateContext, runner: () => Promise<TaskStatus>): Transition => {
  const transition: Transition = async (state, status) => {
    switch (state) {
      case "evaluate": {
        if (ctx.shouldSkip) return transition("skip");
        return transition("run");
      }
      case "skip":
        return transition("cache", TaskStatus.SKIP);
      case "run": {
        return transition("cache", await runner());
      }
      case "cache": {
        if (status === undefined) return transition("done", TaskStatus.SKIP);
        if (status !== TaskStatus.FAIL) ctx.updateCache();
        return transition("done", status);
      }
      case "done":
        return status ?? TaskStatus.SKIP;
    }
  };

  return transition;
};
