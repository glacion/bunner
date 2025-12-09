import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

type CacheData = Record<string, string>;

export interface Cache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  save(): Promise<void>;
}

export const resolveLockPath = (cwd: string, root = cwd): string => {
  const candidate = path.join(cwd, "bunner.lock");
  const parent = path.dirname(cwd);
  if (fs.existsSync(candidate)) return candidate;
  if (parent === cwd) return path.join(root, "bunner.lock");
  return resolveLockPath(parent, root);
};

export class CacheStore implements Cache {
  private data: CacheData;
  private readonly filePath: string;

  constructor(filePath = resolveLockPath(process.cwd())) {
    this.filePath = filePath;
    this.data = readCacheFile(filePath);
  }

  get(key: string): string | undefined {
    return this.data[key];
  }

  set(key: string, value: string) {
    this.data[key] = value;
  }

  async save() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsp.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
  }
}

const readCacheFile = (filePath: string): CacheData => {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content);
  if (parsed && typeof parsed === "object") return parsed as CacheData;
  return {};
};
