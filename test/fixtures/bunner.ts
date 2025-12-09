import { Command } from "../../lib/command";
import { Graph } from "../../lib/graph";

const dag = new Graph(import.meta.dir);

const pass = dag.add(new Command({ name: "pass", cwd: import.meta.dir }, "true"));
const fail = dag.add(new Command({ name: "fail", cwd: import.meta.dir }, "false"));

const deepFail = dag.add(new Command({ name: "deep-fail", cwd: import.meta.dir, dependsOn: [fail] }, "true"));
dag.add(new Command({ name: "dep-deep-fail", cwd: import.meta.dir, dependsOn: [deepFail] }, "true"));

dag.add(new Command({ name: "multi-dep", cwd: import.meta.dir, dependsOn: [pass, fail] }, "true"));

dag.add(new Command({ name: "env-test", cwd: import.meta.dir, environment: { BUNNER_TEST: "hello" } }, "/usr/bin/env", "bash", "-c", "echo $BUNNER_TEST"));

export default dag;
