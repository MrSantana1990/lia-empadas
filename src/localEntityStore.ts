import fs from "node:fs/promises";
import path from "node:path";
import type { ZodSchema } from "zod";

export type LocalEntityStoreOptions = {
  /**
   * Optional prefix used to store multiple entity types in the same directory.
   * Example: "finance_categories__" -> files like "finance_categories__<id>.json".
   */
  filePrefix?: string;
};

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function safeReadText(fullPath: string): Promise<string | null> {
  try {
    return await fs.readFile(fullPath, "utf8");
  } catch (e: any) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}

async function safeUnlink(fullPath: string) {
  try {
    await fs.unlink(fullPath);
  } catch (e: any) {
    if (e?.code === "ENOENT") return;
    throw e;
  }
}

export class LocalEntityStore<T extends { id: string }> {
  private readonly idToPath = new Map<string, string>();
  private readonly filePrefix: string;

  constructor(
    private readonly dir: string,
    private readonly schema: ZodSchema<T>,
    options?: LocalEntityStoreOptions
  ) {
    this.filePrefix = options?.filePrefix ?? "";
  }

  private fileNameForId(id: string) {
    return `${this.filePrefix}${id}.json`;
  }

  private fullPathForId(id: string) {
    return path.join(this.dir, this.fileNameForId(id));
  }

  async list(): Promise<T[]> {
    await ensureDir(this.dir);

    const entries = await fs.readdir(this.dir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => name.endsWith(".json"))
      .filter((name) => (this.filePrefix ? name.startsWith(this.filePrefix) : true));

    const items: T[] = [];
    for (const name of jsonFiles) {
      const fullPath = path.join(this.dir, name);
      const raw = await safeReadText(fullPath);
      if (!raw) continue;
      try {
        const parsed = this.schema.parse(JSON.parse(raw));
        this.idToPath.set(parsed.id, fullPath);
        items.push(parsed);
      } catch {
        // Ignore malformed local files.
      }
    }

    return items;
  }

  async get(id: string): Promise<T | null> {
    await ensureDir(this.dir);

    const cached = this.idToPath.get(id);
    const fullPath = cached ?? this.fullPathForId(id);

    const raw = await safeReadText(fullPath);
    if (!raw) return null;

    const parsed = this.schema.parse(JSON.parse(raw));
    this.idToPath.set(id, fullPath);
    return parsed;
  }

  async put(id: string, data: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T> {
    await ensureDir(this.dir);

    const next = this.schema.parse({ ...(data as any), id });
    const fullPath = this.fullPathForId(id);

    await fs.writeFile(fullPath, JSON.stringify(next, null, 2), "utf8");
    this.idToPath.set(id, fullPath);
    return next;
  }

  async delete(id: string): Promise<void> {
    await ensureDir(this.dir);

    const cached = this.idToPath.get(id);
    const fullPath = cached ?? this.fullPathForId(id);
    await safeUnlink(fullPath);
    this.idToPath.delete(id);
  }
}

