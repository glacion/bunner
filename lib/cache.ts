import { Lock, type LockData } from "./lock";

type Data = LockData;

export class CacheStore implements Cache {
  private readonly lock: Lock;

  constructor(lock: Lock) {
    this.lock = lock;
  }

  get(key: string): string | undefined {
    return this.lock.get(key);
  }

  set(key: string, value: string) {
    this.lock.set(key, value);
  }

  async save() {
    await this.lock.write();
  }
}

export interface Cache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  save(): Promise<void>;
}
