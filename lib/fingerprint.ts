import { createHash } from "node:crypto";
import path from "node:path";

export interface FingerprintConfig {
  cwd: string;
  inputs?: string[] | undefined;
  outputs?: string[] | undefined;
}

export class Fingerprint {
  readonly cwd: string;
  private readonly inputs: string[] | undefined;
  private readonly outputs: string[] | undefined;

  constructor({ cwd, inputs, outputs }: FingerprintConfig) {
    this.cwd = cwd;
    this.inputs = inputs;
    this.outputs = outputs;
  }

  hasInputs(): boolean {
    return Boolean(this.inputs && this.inputs.length > 0);
  }

  hasOutputs(): boolean {
    return Boolean(this.outputs && this.outputs.length > 0);
  }

  async inputHash(): Promise<string | undefined> {
    if (!this.inputs || this.inputs.length === 0) return undefined;
    const outputMatches = new Set(await this.match(this.outputs));
    const files = (await this.match(this.inputs)).filter((match) => !outputMatches.has(match)).sort();

    const contents = await Promise.all(
      files.map((absolute) =>
        Bun.file(absolute)
          .arrayBuffer()
          .then((buffer) => new Uint8Array(buffer)),
      ),
    );

    const hash = this.inputs.reduce((acc, pattern) => acc.update(pattern), createHash("sha256"));
    files.forEach((filePath, index) => {
      const content = contents[index];
      if (filePath !== undefined) hash.update(filePath);
      if (content !== undefined) hash.update(content);
    });

    if (files.length === 0) hash.update("EMPTY");

    return hash.digest("hex");
  }

  async outputsMissing(): Promise<boolean> {
    if (!this.outputs || this.outputs.length === 0) return false;
    return (await this.match(this.outputs)).length === 0;
  }

  private async match(patterns: string[] | undefined): Promise<string[]> {
    if (!patterns || patterns.length === 0) return [];
    const cwd = this.cwd;
    const options = { cwd, dot: true };
    const results = await Promise.all(
      patterns.map(async (pattern) => {
        const glob = new Bun.Glob(pattern);
        const matches: string[] = [];
        for await (const match of glob.scan(options)) {
          matches.push(path.resolve(cwd, match));
        }
        return matches;
      }),
    );
    return [...new Set(results.flat())];
  }
}
