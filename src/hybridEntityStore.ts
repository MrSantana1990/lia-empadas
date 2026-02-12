import type { ZodSchema } from "zod";

type StoreLike<T extends { id: string }> = {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  put(id: string, data: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T>;
  delete(id: string): Promise<void>;
};

function isServiceAccountNoQuotaError(err: unknown) {
  const e = err as any;
  const msg = e?.response?.data?.error?.message ?? e?.message ?? "";
  return typeof msg === "string" && msg.includes("Service Accounts do not have storage quota");
}

export class HybridEntityStore<T extends { id: string }> {
  private seededLocal = false;

  constructor(
    private readonly driveStore: StoreLike<T>,
    private readonly localStore: StoreLike<T>,
    private readonly schema: ZodSchema<T>,
    private readonly opts?: { devFallbackEnabled?: boolean; scopeLabel?: string }
  ) {}

  private get devFallbackEnabled() {
    return Boolean(this.opts?.devFallbackEnabled);
  }

  private async seedLocalFromDrive() {
    if (this.seededLocal) return;
    this.seededLocal = true;
    try {
      const items = await this.driveStore.list();
      await Promise.all(
        items.map((it) => this.localStore.put(it.id, this.schema.parse(it) as any))
      );
    } catch {
      // ignore
    }
  }

  async list(): Promise<T[]> {
    if (!this.devFallbackEnabled) return this.driveStore.list();

    const [local, drive] = await Promise.allSettled([
      this.localStore.list(),
      this.driveStore.list(),
    ]);

    const localItems = local.status === "fulfilled" ? local.value : [];
    const driveItems = drive.status === "fulfilled" ? drive.value : [];

    const byId = new Map<string, T>();
    for (const it of driveItems) byId.set(it.id, it);
    for (const it of localItems) byId.set(it.id, it);

    return Array.from(byId.values());
  }

  async get(id: string): Promise<T | null> {
    if (this.devFallbackEnabled) {
      try {
        const local = await this.localStore.get(id);
        if (local) return local;
      } catch {
        // ignore
      }
    }

    try {
      return await this.driveStore.get(id);
    } catch (err) {
      if (
        this.devFallbackEnabled &&
        isServiceAccountNoQuotaError(err)
      ) {
        return await this.localStore.get(id).catch(() => null);
      }
      throw err;
    }
  }

  async put(id: string, data: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T> {
    try {
      const res = await this.driveStore.put(id, data);
      if (this.devFallbackEnabled) {
        await this.localStore.delete(id).catch(() => undefined);
      }
      return res;
    } catch (err) {
      if (this.devFallbackEnabled && isServiceAccountNoQuotaError(err)) {
        await this.seedLocalFromDrive();
        return this.localStore.put(id, data);
      }
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.driveStore.delete(id);
      if (this.devFallbackEnabled) {
        await this.localStore.delete(id).catch(() => undefined);
      }
      return;
    } catch (err) {
      if (this.devFallbackEnabled && isServiceAccountNoQuotaError(err)) {
        await this.seedLocalFromDrive();
        return this.localStore.delete(id);
      }
      throw err;
    }
  }
}
