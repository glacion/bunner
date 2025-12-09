import { Command } from "./lib/command";
import { Task } from "./lib/task";

const install = new Command({ name: "install", directory: import.meta.dir }, "bun", "install");
const lint = new Command({ name: "lint", directory: import.meta.dir, dependsOn: [install] }, "biome", "ci");
const test = new Command({ name: "test", directory: import.meta.dir, dependsOn: [install] }, "bun", "test");
const check = new Command({ name: "check", directory: import.meta.dir, dependsOn: [lint, test] }, "true");
const publish = new Command({ name: "publish", directory: import.meta.dir, dependsOn: [check] }, "bun", "publish");

export default new Task({ name: "bunner", dependsOn: [publish], isGroup: true });
