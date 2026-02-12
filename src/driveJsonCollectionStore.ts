import type { drive_v3 } from "googleapis";
import type { ZodSchema } from "zod";

function parseJsonMaybe<T>(raw: unknown): T {
  if (raw && typeof raw === "object") return raw as T;
  if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString("utf8")) as T;
  const text = String(raw ?? "");
  if (!text) throw new Error("Empty JSON");
  return JSON.parse(text) as T;
}

async function downloadJson<T>(drive: drive_v3.Drive, fileId: string): Promise<T> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" as any }
  );
  return parseJsonMaybe<T>(res.data);
}

async function findFileIdByName(
  drive: drive_v3.Drive,
  folderId: string,
  name: string
) {
  const list = await drive.files.list({
    q: [`'${folderId}' in parents`, `name='${name.replace(/'/g, "\\'")}'`, "trashed=false"].join(
      " and "
    ),
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return list.data.files?.[0]?.id ?? null;
}

export class DriveJsonCollectionStore<T extends { id: string }> {
  private fileId: string | null = null;

  constructor(
    private readonly drive: drive_v3.Drive,
    private readonly folderId: string,
    private readonly fileName: string,
    private readonly schema: ZodSchema<T>
  ) {}

  private async ensureFileId(): Promise<string> {
    if (this.fileId) return this.fileId;

    const existing = await findFileIdByName(this.drive, this.folderId, this.fileName);
    if (existing) {
      this.fileId = existing;
      return existing;
    }

    // Try to create a new JSON file with an empty array.
    // Note: Service Accounts may not have Drive quota in personal drives; in that case
    // this create will fail and the caller should surface a clear message.
    const created = await this.drive.files.create({
      requestBody: {
        name: this.fileName,
        parents: [this.folderId],
        mimeType: "application/json",
      },
      media: { mimeType: "application/json", body: "[]" },
      fields: "id",
      supportsAllDrives: true,
    });

    const id = created.data.id;
    if (!id) throw new Error(`Failed to create Drive file: ${this.fileName}`);
    this.fileId = id;
    return id;
  }

  private async readAll(): Promise<T[]> {
    const id = await this.ensureFileId();
    const raw = await downloadJson<unknown>(this.drive, id);
    const arr = Array.isArray(raw) ? raw : [];
    const items: T[] = [];
    for (const it of arr) {
      try {
        items.push(this.schema.parse(it));
      } catch {
        // ignore invalid items
      }
    }
    return items;
  }

  private async writeAll(items: T[]): Promise<void> {
    const id = await this.ensureFileId();
    await this.drive.files.update({
      fileId: id,
      media: { mimeType: "application/json", body: JSON.stringify(items) },
      supportsAllDrives: true,
    });
  }

  async list(): Promise<T[]> {
    return this.readAll();
  }

  async get(id: string): Promise<T | null> {
    const items = await this.readAll();
    return items.find((x) => x.id === id) ?? null;
  }

  async put(id: string, data: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T> {
    const next = this.schema.parse({ ...(data as any), id });
    const items = await this.readAll();
    const idx = items.findIndex((x) => x.id === id);
    if (idx >= 0) items[idx] = next;
    else items.push(next);
    await this.writeAll(items);
    return next;
  }

  async delete(id: string): Promise<void> {
    const items = await this.readAll();
    const next = items.filter((x) => x.id !== id);
    if (next.length === items.length) return;
    await this.writeAll(next);
  }
}

