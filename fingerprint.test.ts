import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fingerprint } from "./lib/fingerprint";

test("detects outputs inside node_modules", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "bunner-fingerprint-"));
  const output = join(cwd, "node_modules", "pkg", "index.js");

  mkdirSync(join(cwd, "node_modules", "pkg"), { recursive: true });
  writeFileSync(output, "console.log('hello');");

  const fingerprint = new Fingerprint({ cwd, outputs: ["node_modules/**/*"] });
  expect(await fingerprint.outputsMissing()).toBe(false);

  rmSync(cwd, { recursive: true, force: true });
});
