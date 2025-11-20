import { expect, test } from "bun:test";

const run = (args: string[]) =>
  Bun.spawnSync({
    cmd: ["bun", "run", "index.ts", "--file", "test/bunner.ts", ...args],
    stderr: "pipe",
    stdout: "pipe",
  });

test("lists all available tasks when no arguments are provided", () => {
  const { stdout } = run([]);
  expect(stdout.toString()).toInclude("bunner:pass");
  expect(stdout.toString()).toInclude("bunner:fail");
});

test("runs a passing task", () => {
  const { exitCode } = run(["pass"]);
  expect(exitCode).toBe(0);
});

test("handles failing tasks", () => {
  const scenarios = [
    {
      args: ["fail"],
      expected: ["- bunner:fail"],
    },
    {
      args: ["pass", "fail"],
      expected: ["- bunner:fail"],
    },
    {
      args: ["dep-deep-fail"],
      expected: ["- bunner:dep-deep-fail"],
    },
    {
      args: ["fail", "multi-dep"],
      expected: ["- bunner:fail", "- bunner:multi-dep"],
    },
  ];

  for (const { args, expected } of scenarios) {
    const { exitCode, stderr } = run(args);
    const stderrString = stderr.toString();
    expect(exitCode).toBe(1);
    expect(stderrString).toInclude("Failed tasks:");
    for (const task of expected) {
      expect(stderrString).toInclude(task);
    }
  }
});

test("reports an error when the task is unknown", () => {
  const { exitCode, stderr } = run(["unknown"]);
  expect(exitCode).toBe(1);
  expect(stderr.toString()).toInclude("no tasks found for pattern unknown");
});

test("prints the execution graph when --dry-run is provided", () => {
  const { stdout } = run(["--dry-run", "pass"]);
  expect(stdout.toString()).toInclude("digraph");
  expect(stdout.toString()).toInclude('"bunner:pass"');
});

test("runs tasks matching a regex pattern", () => {
  const { exitCode, stderr } = run(["pass|fail"]);
  expect(exitCode).toBe(1);
  expect(stderr.toString()).toInclude("Failed tasks:");
  expect(stderr.toString()).toInclude("- bunner:fail");
});

test("correctly passes environment variables to commands", async () => {
  run(["env-test"]);
  const content = await Bun.file("/tmp/bunner-env-test").text();
  expect(content).toInclude("hello");
});
