import { describe, expect, test } from "bun:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "src/index.ts");
const fixturePath = path.join(repoRoot, "test/bunner.ts");

const readStream = (stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> => {
  if (!stream) return Promise.resolve("");
  const decoder = new TextDecoder();
  const reader = stream.getReader();

  const pump = (buffer: string): Promise<string> =>
    reader.read().then(({ done, value }) => {
      if (done) return buffer + decoder.decode();
      const next = buffer + decoder.decode(value, { stream: true });
      return pump(next);
    });

  return pump("");
};

const runCLI = async (args: string[] = [], options: { cwd?: string } = {}) => {
  const cwd = options.cwd ?? repoRoot;
  const scriptArgs = ["--file", path.relative(cwd, fixturePath), ...args];
  const command = ["bun", "run", cliEntry, "--", ...scriptArgs];
  const child = Bun.spawn(command, {
    cwd,
    stderr: "pipe",
    stdout: "pipe",
  });

  const stdoutPromise = readStream(child.stdout);
  const stderrPromise = readStream(child.stderr);
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return { exitCode, stderr, stdout };
};

const expectedTasks = [
  "root:build",
  "root:child:alpha",
  "root:child:beta",
  "root:command",
  "root:cycle:a",
  "root:cycle:b",
  "root:function",
  "root:hello",
  "root:test",
];

describe("cli", () => {
  test("lists tasks by default", async () => {
    const result = await runCLI();
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe("");
    expect(result.stdout.trim().split("\n")).toEqual(expectedTasks);
  });

  test("fails when --dry-run is used without patterns", async () => {
    const result = await runCLI(["--dry-run"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.trim()).toBe("--dry-run requires at least one task pattern");
  });

  test("prints dry-run plan for selected tasks", async () => {
    const result = await runCLI(["--dry-run", "root:child:alpha"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe("");
    expect(result.stdout.trim()).toBe(["1. root:build", "2. root:child:alpha"].join("\n"));
  });

  test("fails on invalid regex", async () => {
    const result = await runCLI(["["]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid regex "["');
  });

  test("fails when no tasks match and lists available ones", async () => {
    const result = await runCLI(["does-not-exist"]);
    expect(result.exitCode).toBe(1);
    const lines = result.stderr.trim().split("\n");
    expect(lines[0]).toBe("No tasks matched the provided patterns");
    expect(lines[1]).toBe("Available tasks:");
    expect(lines.slice(2)).toEqual(expectedTasks.map((task) => `  - ${task}`));
  });

  test("reports cycles during dry run", async () => {
    const result = await runCLI(["--dry-run", "root:cycle:a"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cycle detected involving root:cycle:a");
  });

  test("runs command tasks and streams output", async () => {
    const result = await runCLI(["root:command"]);
    expect(result.exitCode).toBe(0);
    expect(stripVTControlCharacters(result.stdout).trim().split("\n")).toEqual(["[root:command]: cmd-out"]);
    expect(stripVTControlCharacters(result.stderr).trim().split("\n")).toEqual(["[root:command]: cmd-err"]);
  });

  test("runs function tasks", async () => {
    const result = await runCLI(["root:function"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("fn-out");
    expect(result.stderr.trim()).toBe("fn-err");
  });

  test("lists tasks when --list is supplied alongside patterns", async () => {
    const result = await runCLI(["--list", "root:function"]);
    expect(result.exitCode).toBe(0);

    const stdoutLines = result.stdout
      .trim()
      .split("\n")
      .filter((line) => line.length);
    expect(stdoutLines.slice(0, expectedTasks.length)).toEqual(expectedTasks);
    expect(stdoutLines.at(-1)).toBe("fn-out");
    expect(stripVTControlCharacters(result.stderr).trim()).toBe("fn-err");
  });

  test("finds bunner file when invoked from nested directories", async () => {
    const nested = path.join(repoRoot, "test");
    const result = await runCLI([], { cwd: nested });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().split("\n")).toEqual(expectedTasks);
  });
});
