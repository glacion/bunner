import { Command } from "../lib/command";
import { Node } from "../lib/node";

const root = new Node({ directory: import.meta.dir, name: "bunner" });

const pass = root.child(new Command({ name: "pass", command: ["true"] }));
const fail = root.child(new Command({ name: "fail", command: ["false"] }));
root.child(new Node({ name: "dep-pass", dependencies: [pass] }));
const depFail = root.child(new Node({ name: "dep-fail", dependencies: [fail] }));
root.child(new Node({ name: "dep-deep-fail", dependencies: [depFail] }));
root.child(new Node({ name: "multi-dep", dependencies: [pass, fail] }));
root.child(
  new Command({
    name: "env-test",
    command: ["bun", "-e", 'Bun.write("/tmp/bunner-env-test", process.env.FOO)'],
    environment: { FOO: "hello" },
  }),
);

export default { root };
