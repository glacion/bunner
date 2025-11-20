import { Command } from "../command";
import { Node } from "../node";

const root = new Node({ directory: import.meta.dir, name: "bunner" });

const pass = root.child(new Command({ name: "pass", command: ["true"] }));
const fail = root.child(new Command({ name: "fail", command: ["false"] }));

// For testing deep dependency failure
const deepFail = root.child(new Node({ name: "deep-fail", dependencies: [fail] }));
root.child(new Node({ name: "dep-deep-fail", dependencies: [deepFail] }));

// For testing multiple dependencies
root.child(new Node({ name: "multi-dep", dependencies: [pass, fail] }));

// For testing environment variables
root.child(
  new Command({
    name: "env-test",
    command: ["/usr/bin/env", "bash", "-c", "echo $BUNNER_TEST"],
    environment: { BUNNER_TEST: "hello" },
  }),
);

export default { root };
