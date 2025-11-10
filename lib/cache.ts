import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

type CacheRecord = Record<string, string>;

interface CacheState {
  data: CacheRecord;
  path: string;
}

let state: CacheState | undefined;
let pendingPersist: Promise<void> | undefined;

const resolveDefaultCachePath = () => {
  const xdg = process.env["XDG_CACHE_HOME"];
  if (xdg?.trim().length) return path.resolve(xdg, "bunner", "cache.json");
  const home = homedir();
  if (home) return path.resolve(home, ".cache", "bunner", "cache.json");
  return path.resolve(process.cwd(), ".bunner-cache.json");
};

const cachePath = () => process.env["BUNNER_CACHE"] ?? resolveDefaultCachePath();

const readCacheFile = (target: string): Promise<CacheRecord> =>
  readFile(target, "utf8")
    .then((raw) =>
      Promise.resolve(raw)
        .then((value) => JSON.parse(value))
        .then((parsed) =>
          parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as CacheRecord) : {},
        ),
    )
    .catch(() => ({}));

const ensureState = async (): Promise<CacheState> => {
  const target = cachePath();
  if (state && state.path === target) return state;
  state = { data: await readCacheFile(target), path: target };
  return state;
};

const persist = async (current: CacheState) => {
  await mkdir(path.dirname(current.path), { recursive: true });
  await writeFile(current.path, JSON.stringify(current.data, null, 2));
};

const queuePersist = (current: CacheState) => {
  const flush = (pendingPersist ?? Promise.resolve()).then(() => persist(current));
  const chained = flush.finally(() => {
    if (pendingPersist === chained) {
      pendingPersist = undefined;
    }
  });
  pendingPersist = chained;
  return chained;
};

export const getSignature = async (task: string): Promise<string | undefined> => {
  const current = await ensureState();
  return current.data[task];
};

export const setSignature = async (task: string, signature: string): Promise<void> => {
  const current = await ensureState();
  if (current.data[task] === signature) return;
  current.data[task] = signature;
  await queuePersist(current);
};
