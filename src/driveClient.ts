import { google, type drive_v3 } from "googleapis";

let cachedDrive: drive_v3.Drive | null = null;

function decodeJsonTextFromBase64(b64: string) {
  const buf = Buffer.from(b64, "base64");

  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString("utf16le").replace(/^\uFEFF/, "").trim();
  }

  // UTF-16 BE BOM -> convert to LE
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return swapped.toString("utf16le").replace(/^\uFEFF/, "").trim();
  }

  // Many Windows flows end up base64-encoding UTF-16LE JSON (lots of NUL bytes).
  if (buf.includes(0)) {
    return buf.toString("utf16le").replace(/^\uFEFF/, "").trim();
  }

  return buf.toString("utf8").replace(/^\uFEFF/, "").trim();
}

function getServiceAccountJson() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) {
    throw new Error("Missing env GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  }

  // Some users accidentally paste `KEY==<value>` (double `=`). Base64 should never start with `=`.
  const raw = b64.trim().replace(/^=+/, "");
  // Tolerate plain JSON for local usage (some users paste the JSON directly).
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw) as {
        client_email: string;
        private_key: string;
        project_id?: string;
      };
    } catch {
      throw new Error(
        "Invalid GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: looks like JSON but could not parse."
      );
    }
  }

  // Be tolerant with whitespace (some editors may wrap long values).
  const normalized = raw.replace(/\s+/g, "");
  const decoded = decodeJsonTextFromBase64(normalized);

  if (!decoded.startsWith("{")) {
    throw new Error(
      "Invalid GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (decoded value is not JSON). " +
        "Confirme que o valor está completo (uma única linha) e realmente em base64."
    );
  }

  try {
    return JSON.parse(decoded) as {
      client_email: string;
      private_key: string;
      project_id?: string;
    };
  } catch {
    throw new Error(
      "Invalid GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (decoded JSON is malformed). " +
        "Confirme que a string base64 não foi cortada/quebrada ao colar no `.env.local`."
    );
  }
}

export function getServiceAccountEmailSafe(): string | null {
  try {
    const credentials = getServiceAccountJson();
    return typeof credentials.client_email === "string" ? credentials.client_email : null;
  } catch {
    return null;
  }
}

export function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const credentials = getServiceAccountJson();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}
