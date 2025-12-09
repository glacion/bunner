import { Command } from "./lib/command";
import { Graph } from "./lib/graph";

const dag = new Graph(import.meta.dir);

dag.add(new Command({ name: "pass", cwd: import.meta.dir }, "true"));
dag.add(new Command({ name: "fail", cwd: import.meta.dir }, "false"));

export default dag;
