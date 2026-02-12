import type { drive_v3 } from "googleapis";
import type { ZodSchema } from "zod";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveEntityStoreOptions = {
  /**
   * Optional prefix used to store multiple entity types in the same Drive folder.
   * Example: "finance_categories__" -> files like "finance_categories__<id>.json".
   */
  filePrefix?: string;
};

async function findChildFolderId(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
) {
  const list = await drive.files.list({
    q: [
      `'${parentId}' in parents`,
      `mimeType='${DRIVE_FOLDER_MIME}'`,
      `name='${name.replace(/'/g, "\\'")}'`,
      "trashed=false",
    ].join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return list.data.files?.[0]?.id ?? null;
}

export async function ensureFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
) {
  const existingId = await findChildFolderId(drive, parentId, name);
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: DRIVE_FOLDER_MIME,
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new Error(`Failed to create Drive folder: ${name}`);
  return id;
}

async function findFileIdByName(
  drive: drive_v3.Drive,
  folderId: string,
  name: string
) {
  const list = await drive.files.list({
    q: [
      `'${folderId}' in parents`,
      `name='${name.replace(/'/g, "\\'")}'`,
      "trashed=false",
    ].join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return list.data.files?.[0]?.id ?? null;
}

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

export class DriveEntityStore<T extends { id: string }> {
  private readonly idToFileId = new Map<string, string>();
  private readonly filePrefix: string;

  constructor(
    private readonly drive: drive_v3.Drive,
    private readonly folderId: string,
    private readonly schema: ZodSchema<T>,
    options?: DriveEntityStoreOptions
  ) {
    this.filePrefix = options?.filePrefix ?? "";
  }

  private fileNameForId(id: string) {
    return `${this.filePrefix}${id}.json`;
  }

  async list(): Promise<T[]> {
    const files: { id?: string | null; name?: string | null }[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res = (await this.drive.files.list({
        q: [`'${this.folderId}' in parents`, "trashed=false"].join(" and "),
        fields: "nextPageToken,files(id,name)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })) as unknown as { data: drive_v3.Schema$FileList };
      files.push(...(res.data.files ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    const jsonFiles = files.filter((f) => {
      if (!f.id) return false;
      const name = f.name ?? "";
      if (!name.endsWith(".json")) return false;
      if (this.filePrefix && !name.startsWith(this.filePrefix)) return false;
      return true;
    });

    const settled = await Promise.allSettled(
      jsonFiles.map(async (f) => {
        const fileId = f.id as string;
        const raw = await downloadJson<unknown>(this.drive, fileId);
        const parsed = this.schema.parse(raw);
        this.idToFileId.set(parsed.id, fileId);
        return parsed;
      })
    );

    return settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  }

  async get(id: string): Promise<T | null> {
    const cached = this.idToFileId.get(id);
    const fileId =
      cached ?? (await findFileIdByName(this.drive, this.folderId, this.fileNameForId(id)));

    if (!fileId) return null;

    const raw = await downloadJson<unknown>(this.drive, fileId);
    const parsed = this.schema.parse(raw);
    this.idToFileId.set(id, fileId);
    return parsed;
  }

  async put(id: string, data: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T> {
    const next = this.schema.parse({ ...(data as any), id });
    const fileName = this.fileNameForId(id);

    const cached = this.idToFileId.get(id);
    const fileId = cached ?? (await findFileIdByName(this.drive, this.folderId, fileName));

    if (fileId) {
      await this.drive.files.update({
        fileId,
        media: { mimeType: "application/json", body: JSON.stringify(next) },
        supportsAllDrives: true,
      });
      this.idToFileId.set(id, fileId);
      return next;
    }

    const created = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [this.folderId],
        mimeType: "application/json",
      },
      media: { mimeType: "application/json", body: JSON.stringify(next) },
      fields: "id",
      supportsAllDrives: true,
    });

    const newId = created.data.id;
    if (newId) this.idToFileId.set(id, newId);
    return next;
  }

  async delete(id: string): Promise<void> {
    const cached = this.idToFileId.get(id);
    const fileId =
      cached ?? (await findFileIdByName(this.drive, this.folderId, this.fileNameForId(id)));

    if (!fileId) return;
    await this.drive.files.delete({ fileId, supportsAllDrives: true });
    this.idToFileId.delete(id);
  }
}
