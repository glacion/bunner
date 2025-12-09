import { Command } from "./lib/command";
import { Graph } from "./lib/graph";

const dag = new Graph(import.meta.dir);

const install = dag.add(new Command({ name: "install", cwd: import.meta.dir }, "bun", "install"));
const lint = dag.add(new Command({ name: "lint", cwd: import.meta.dir, dependsOn: [install] }, "biome", "ci"));
const test = dag.add(new Command({ name: "test", cwd: import.meta.dir, dependsOn: [install] }, "bun", "test"));
const check = dag.add(new Command({ name: "check", cwd: import.meta.dir, dependsOn: [lint, test] }, "true"));
dag.add(new Command({ name: "publish", cwd: import.meta.dir, dependsOn: [check] }, "bun", "publish"));

export default dag;
