import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type LockData = Record<string, string>;

const resolvePath = (directory: string, root = directory): string => {
  const candidate = path.join(directory, "bunner.lock");
  const parent = path.dirname(directory);
  if (fs.existsSync(candidate)) return candidate;
  if (parent === directory) return path.join(root, "bunner.lock");
  return resolvePath(parent, root);
};

const readFile = (file: string): LockData => {
  if (!fs.existsSync(file)) return {};
  try {
    const content = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") return parsed as LockData;
  } catch {
    // Fall through to return an empty cache when the lock is unreadable.
  }
  return {};
};

const writeFile = async (file: string, data: LockData) => {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(data, null, 2), "utf8");
};

interface LockOptions {
  data?: LockData;
  directory?: string;
  file?: string;
  root?: string;
}

export class Lock {
  readonly file: string;
  private data: LockData;

  constructor({ file, directory, root, data }: LockOptions = {}) {
    const base = directory ?? process.cwd();
    this.file = file ?? resolvePath(base, root ?? base);
    this.data = data ?? readFile(this.file);
  }

  resolve(): string {
    return this.file;
  }

  read(): LockData {
    this.data = readFile(this.file);
    return this.data;
  }

  get(key: string): string | undefined {
    return this.data[key];
  }

  set(key: string, value: string): void {
    this.data[key] = value;
  }

  snapshot(): LockData {
    return { ...this.data };
  }

  async write(data: LockData = this.data): Promise<void> {
    this.data = data;
    await writeFile(this.file, this.data);
  }
}
