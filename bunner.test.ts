import { Command } from "./lib/command";
import { Node } from "./lib/node";

const root = new Node({ directory: import.meta.dir, name: "bunner" });

root.child(new Command({ name: "pass", command: ["true"] }));
root.child(new Command({ name: "fail", command: ["false"] }));

export default { root };
