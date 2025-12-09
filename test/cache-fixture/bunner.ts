import { Command } from "../../lib/command";
import { Task } from "../../lib/task";

const install = new Command({ name: "skiptest:install", directory: import.meta.dir, inputs: ["input.txt"] }, "true");
const build = new Command({ name: "skiptest:build", directory: import.meta.dir, dependsOn: [install] }, "true");

export default new Task({ name: "root", dependsOn: [build], isGroup: true });
