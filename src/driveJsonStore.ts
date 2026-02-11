import type { drive_v3 } from "googleapis";

export class DriveJsonStore<T> {
  private fileId: string | null = null;

  constructor(
    private readonly drive: drive_v3.Drive,
    private readonly folderId: string,
    private readonly fileName: string,
    private readonly defaultValue: T
  ) {}

  private async ensureFileId(): Promise<string> {
    if (this.fileId) return this.fileId;

    const list = await this.drive.files.list({
      q: [
        `'${this.folderId}' in parents`,
        `name='${this.fileName.replace(/'/g, "\\'")}'`,
        "trashed=false",
      ].join(" and "),
      fields: "files(id,name)",
      pageSize: 1,
    });

    const existing = list.data.files?.[0];
    if (existing?.id) {
      this.fileId = existing.id;
      return existing.id;
    }

    const created = await this.drive.files.create({
      requestBody: {
        name: this.fileName,
        parents: [this.folderId],
        mimeType: "application/json",
      },
      media: {
        mimeType: "application/json",
        body: JSON.stringify(this.defaultValue),
      },
      fields: "id",
    });

    const id = created.data.id;
    if (!id) throw new Error(`Failed to create ${this.fileName} in Drive`);
    this.fileId = id;
    return id;
  }

  async read(): Promise<T> {
    const fileId = await this.ensureFileId();
    const res = await this.drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );

    const text = String(res.data ?? "");
    if (!text) return this.defaultValue;
    try {
      return JSON.parse(text) as T;
    } catch {
      return this.defaultValue;
    }
  }

  async write(value: T): Promise<void> {
    const fileId = await this.ensureFileId();
    await this.drive.files.update({
      fileId,
      media: {
        mimeType: "application/json",
        body: JSON.stringify(value),
      },
    });
  }
}

