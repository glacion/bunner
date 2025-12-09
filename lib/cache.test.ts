import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveLockPath } from "./cache";

describe("resolveLockPath", () => {
  test("falls back to the starting directory when no lock exists", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bunner-lock-"));
    const nested = path.join(root, "a", "b", "c");
    await mkdir(nested, { recursive: true });

    const resolved = resolveLockPath(nested);
    expect(resolved).toBe(path.join(nested, "bunner.lock"));
  });

  test("returns the nearest existing lock in ancestors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bunner-lock-"));
    const lockPath = path.join(root, "bunner.lock");
    await writeFile(lockPath, "{}");
    const nested = path.join(root, "a", "b");
    await mkdir(nested, { recursive: true });

    const resolved = resolveLockPath(nested);
    expect(resolved).toBe(lockPath);
  });
});
