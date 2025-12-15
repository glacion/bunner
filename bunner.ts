import { Command } from "./lib/command";
import { TargetGraph } from "./lib/graph";
import type { VertexDefinition } from "digraph-js";
import type { Target } from "./lib/target";

const vertex = (target: Target, dependencies: Target[] = []): VertexDefinition<Target> => ({
  id: target.id,
  adjacentTo: dependencies.map((dependency) => dependency.id),
  body: target,
});

const bunner = new TargetGraph({ directory: import.meta.dir, name: "bunner" });

const install = new Command("install", { command: ["bun", "install"], directory: bunner.config.directory });

const lint = new Command("lint", {
  command: ["biome", "ci"],
  dependencies: [install],
  directory: bunner.config.directory,
});
const test = new Command("test", {
  command: ["bun", "test"],
  dependencies: [install],
  directory: bunner.config.directory,
});

const check = new Command("check", { dependencies: [lint, test], directory: bunner.config.directory });

const publish = new Command("publish", {
  command: ["bun", "publish"],
  dependencies: [check],
  directory: bunner.config.directory,
});

const pipeline = new TargetGraph({ directory: bunner.config.directory, name: "pipeline" });
pipeline.addVertices(
  vertex(install),
  vertex(lint, [install]),
  vertex(test, [install]),
  vertex(check, [lint, test]),
  vertex(publish, [check]),
);

bunner.child(pipeline);

export default bunner;
