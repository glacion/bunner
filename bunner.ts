import { Command } from "#/lib/command";
import { Node } from "#/lib/node";

const bunner = new Node({ name: "bunner" });

const install = bunner.child(new Command({ name: "install", command: ["bun", "install"] }));

const lint = bunner.child(new Command({ name: "lint", command: ["biome", "ci"], dependencies: [install] }));
const test = bunner.child(new Command({ name: "test", command: ["bun", "test"], dependencies: [install] }));

const check = bunner.child(new Node({ name: "check", dependencies: [lint, test] }));

bunner.child(new Command({ name: "publish", command: ["bun", "publish"], dependencies: [check] }));

export default bunner;
