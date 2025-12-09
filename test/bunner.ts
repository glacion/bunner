import { Command } from "../lib/command";
import { Graph } from "../lib/graph";

const dag = new Graph(import.meta.dir);

const pass = dag.add(new Command({ name: "pass", cwd: import.meta.dir }, "true"));
const fail = dag.add(new Command({ name: "fail", cwd: import.meta.dir }, "false"));

dag.add(new Command({ name: "dep-pass", cwd: import.meta.dir, dependsOn: [pass] }, "true"));
const depFail = dag.add(new Command({ name: "dep-fail", cwd: import.meta.dir, dependsOn: [fail] }, "true"));
dag.add(new Command({ name: "dep-deep-fail", cwd: import.meta.dir, dependsOn: [depFail] }, "true"));
dag.add(new Command({ name: "multi-dep", cwd: import.meta.dir, dependsOn: [pass, fail] }, "true"));
dag.add(
  new Command(
    {
      name: "env-test",
      cwd: import.meta.dir,
      environment: { FOO: "hello" },
    },
    "bun",
    "-e",
    'Bun.write("/tmp/bunner-env-test", process.env.FOO)',
  ),
);

export default dag;
