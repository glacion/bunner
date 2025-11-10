import type { Task } from "#/lib/task";

export const buildPlan = (roots: Task[]): Task[] => {
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (task: Task): Task[] => {
    if (visited.has(task.fqn)) return [];
    if (visiting.has(task.fqn)) throw new Error(`cycle detected involving ${task.fqn}`);
    visiting.add(task.fqn);
    const dependencies = task.resolve().flatMap(visit);
    visiting.delete(task.fqn);
    visited.add(task.fqn);
    return [...dependencies, task];
  };

  return roots.flatMap(visit);
};
