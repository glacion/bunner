export enum TaskStatus {
  FAIL,
  SUCCESS,
  SKIP,
}

export type ExecuteState = "evaluate" | "skip" | "run" | "cache" | "done";
