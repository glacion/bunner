import { Command } from "../lib/command";
import { Task } from "../lib/task";

const pass = new Command({ name: "pass", directory: import.meta.dir }, "true");
const fail = new Command({ name: "fail", directory: import.meta.dir }, "false");

const deepFail = new Command({ name: "deep-fail", directory: import.meta.dir, dependsOn: [fail] }, "true");
const depDeepFail = new Command({ name: "dep-deep-fail", directory: import.meta.dir, dependsOn: [deepFail] }, "true");

const multiDep = new Command({ name: "multi-dep", directory: import.meta.dir, dependsOn: [pass, fail] }, "true");

const envTest = new Command(
  { name: "env-test", directory: import.meta.dir, environment: { BUNNER_TEST: "hello" } },
  "/usr/bin/env",
  "bash",
  "-c",
  "echo $BUNNER_TEST > /tmp/bunner-env-test",
);

export default new Task({ name: "root", dependsOn: [depDeepFail, multiDep, envTest, pass, fail], isGroup: true });
