import { Command } from "../../lib/command";
import { Graph } from "../../lib/graph";

const graph = new Graph(import.meta.dir);

const pass = graph.add(new Command({ name: "pass", directory: import.meta.dir }, "true"));
const fail = graph.add(new Command({ name: "fail", directory: import.meta.dir }, "false"));

const deepFail = graph.add(new Command({ name: "deep-fail", directory: import.meta.dir, dependsOn: [fail] }, "true"));
graph.add(new Command({ name: "dep-deep-fail", directory: import.meta.dir, dependsOn: [deepFail] }, "true"));

graph.add(new Command({ name: "multi-dep", directory: import.meta.dir, dependsOn: [pass, fail] }, "true"));

graph.add(new Command({ name: "env-test", directory: import.meta.dir, environment: { BUNNER_TEST: "hello" } }, "/usr/bin/env", "bash", "-c", "echo $BUNNER_TEST"));

export default graph;
