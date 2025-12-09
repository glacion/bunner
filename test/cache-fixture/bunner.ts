import { Command } from "../../lib/command";
import { Graph } from "../../lib/graph";

const dag = new Graph(import.meta.dir);

const install = dag.add(new Command({ name: "skiptest:install", cwd: import.meta.dir, inputs: ["input.txt"] }, "true"));
dag.add(new Command({ name: "skiptest:build", cwd: import.meta.dir, dependsOn: [install] }, "true"));

export default dag;
