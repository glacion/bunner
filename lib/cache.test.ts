import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { getSignature, setSignature } from "#/lib/cache";

let tempDir: string | undefined;
let cacheFile: string | undefined;

const prepare = async () => {
  tempDir = await mkdtemp("/tmp/bunner-cache-");
  cacheFile = path.join(tempDir, "cache.json");
  process.env["BUNNER_CACHE"] = cacheFile;
};

const cleanup = async () => {
  delete process.env["BUNNER_CACHE"];
  if (tempDir) {
    await rm(tempDir, { force: true, recursive: true });
  }
  tempDir = undefined;
  cacheFile = undefined;
};

afterEach(async () => {
  await cleanup();
});

describe("cache", () => {
  test("returns undefined for missing signatures", async () => {
    await prepare();
    expect(await getSignature("namespace:task")).toBeUndefined();
  });

  test("persists signatures to disk", async () => {
    await prepare();

    await setSignature("namespace:task", "sig-1");
    expect(await getSignature("namespace:task")).toBe("sig-1");

    const raw = await readFile(cacheFile!, "utf-8");
    expect(JSON.parse(raw)).toEqual({ "namespace:task": "sig-1" });

    await setSignature("namespace:task", "sig-2");
    expect(await getSignature("namespace:task")).toBe("sig-2");
  });

  test("isolates cache files between runs", async () => {
    await prepare();
    await setSignature("namespace:task", "sig-1");
    const firstPath = cacheFile!;
    await cleanup();

    await prepare();
    const secondPath = cacheFile!;
    expect(secondPath).not.toBe(firstPath);
    expect(await getSignature("namespace:task")).toBeUndefined();
  });
});
