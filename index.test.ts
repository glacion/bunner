import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "index.ts");

const run = (args: string[]) =>
  Bun.spawnSync({
    cmd: ["bun", "run", cliPath, "--file", "test/bunner.ts", ...args],
    stderr: "pipe",
    stdout: "pipe",
  });

test("lists all available tasks when no arguments are provided", () => {
  const { stdout } = run([]);
  expect(stdout.toString()).toInclude("pass");
  expect(stdout.toString()).toInclude("fail");
});

test("runs a passing task", () => {
  const { exitCode } = run(["pass"]);
  expect(exitCode).toBe(0);
});

test("handles failing tasks", () => {
  const scenarios = [
    {
      args: ["fail"],
      expected: ["- fail"],
    },
    {
      args: ["pass", "fail"],
      expected: ["- fail"],
    },
    {
      args: ["dep-deep-fail"],
      expected: ["- dep-deep-fail"],
    },
    {
      args: ["fail", "multi-dep"],
      expected: ["- fail", "- multi-dep"],
    },
  ];

  scenarios.forEach(({ args, expected }) => {
    const { exitCode, stderr } = run(args);
    const stderrString = stderr.toString();
    expect(exitCode).toBe(1);
    expect(stderrString).toInclude("Failed tasks:");
    expected.forEach((task) => {
      expect(stderrString).toInclude(task);
    });
  });
});

test("reports an error when the task is unknown", () => {
  const { exitCode, stderr } = run(["unknown"]);
  expect(exitCode).toBe(1);
  expect(stderr.toString()).toInclude("no tasks found for pattern unknown");
});

test("prints the execution graph when --dry-run is provided", () => {
  const { stdout } = run(["--dry-run", "pass"]);
  expect(stdout.toString()).toInclude("digraph");
  expect(stdout.toString()).toInclude('"pass"');
});

test("runs tasks matching a regex pattern", () => {
  const { exitCode, stderr } = run(["pass|fail"]);
  expect(exitCode).toBe(1);
  expect(stderr.toString()).toInclude("Failed tasks:");
  expect(stderr.toString()).toInclude("- fail");
});

test("correctly passes environment variables to commands", async () => {
  run(["env-test"]);
  const content = await Bun.file("/tmp/bunner-env-test").text();
  expect(content).toInclude("hello");
});

test("verbose output lists all skipped tasks", () => {
  const fixture = join(import.meta.dir, "test", "cache-fixture", "bunner.ts");
  const cwd = mkdtempSync(join(tmpdir(), "bunner-cache-fixture-"));

  const runWithCache = (args: string[]) =>
    Bun.spawnSync({
      cmd: ["bun", "run", cliPath, "--file", fixture, ...args],
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    });

  const first = runWithCache(["build"]);
  expect(first.exitCode).toBe(0);

  const second = runWithCache(["--verbose", "build"]);
  const stderr = second.stderr.toString();
  expect(stderr).toInclude("Skipped tasks:");
  expect(stderr).toInclude("- skiptest:build");
  expect(stderr).toInclude("- skiptest:install");

  rmSync(cwd, { recursive: true, force: true });
});
