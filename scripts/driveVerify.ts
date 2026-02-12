import { loadEnvFiles } from "../src/loadEnv";
import { getDriveClient, getServiceAccountEmailSafe } from "../src/driveClient";

loadEnvFiles();

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const REQUIRED_FILES = [
  "finance_categories.json",
  "finance_transactions.json",
  "finance_accounts.json",
  "catalog_products.json",
] as const;

async function findFileIdByName(drive: ReturnType<typeof getDriveClient>, folderId: string, name: string) {
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

async function downloadText(drive: ReturnType<typeof getDriveClient>, fileId: string) {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" as any }
  );
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
}

async function main() {
  const folderId = requiredEnv("GOOGLE_DRIVE_ADMIN_FOLDER_ID");
  const serviceAccountEmail = getServiceAccountEmailSafe();
  const drive = getDriveClient();

  const found: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of REQUIRED_FILES) {
    const id = await findFileIdByName(drive, folderId, name);
    if (!id) missing.push(name);
    else found[name] = id;
  }

  if (missing.length > 0) {
    const saLine = serviceAccountEmail ? `\nService account: ${serviceAccountEmail}` : "";
    throw new Error(
      `Arquivos faltando na pasta do Drive (GOOGLE_DRIVE_ADMIN_FOLDER_ID).\n` +
        `Crie estes arquivos com conteúdo inicial [] e compartilhe a pasta com a service account como Editor:\n` +
        `- ${missing.join("\n- ")}${saLine}`
    );
  }

  // Read + write back the same content (verifica permissão de leitura/escrita).
  for (const name of REQUIRED_FILES) {
    const id = found[name];
    const text = await downloadText(drive, id);
    JSON.parse(text); // validate JSON

    await drive.files.update({
      fileId: id,
      media: { mimeType: "application/json", body: text },
      supportsAllDrives: true,
    });
  }

  process.stdout.write("DRIVE_VERIFY_OK\n");
}

main().catch((e) => {
  process.stderr.write(String(e?.message ?? e) + "\n");
  process.exit(1);
});

