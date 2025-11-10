import path from "node:path";
import { Namespace } from "#/lib/namespace";

const bunner = new Namespace({ name: "bunner" });

const runCli = async (args: string[] = [], options: { cwd?: string } = {}) => {
  const cwd = options.cwd ?? process.cwd();
  const entry = path.resolve(__dirname, "src/index.ts");
  const fixture = path.resolve(__dirname, "test/bunner.ts");
  const scriptArgs = ["--file", path.relative(cwd, fixture), ...args];
  const command = ["bun", "run", entry, "--", ...scriptArgs];
  const child = Bun.spawn(command, { cwd, stderr: "pipe", stdout: "pipe" });
  const stdoutPromise = child.stdout ? child.stdout.text() : Promise.resolve("");
  const stderrPromise = child.stderr ? child.stderr.text() : Promise.resolve("");
  const [stdout, stderr, exitCode] = await Promise.all([stdoutPromise, stderrPromise, child.exited]);
  return { exitCode, stderr, stdout };
};

bunner.task({
  name: "test",
  command: ["bun", "test"],
});

bunner.task({
  name: "test:cli",
  run: async () => {
    const result = await runCli(["--list"]);
    if (result.exitCode !== 0) throw new Error(`CLI tests failed with code ${result.exitCode}\n${result.stderr}`);
  },
});

bunner.task({
  name: "bunner:test",
  dependencies: ["test", "test:cli"],
});

export default bunner;
