import { google, type drive_v3 } from "googleapis";

let cachedDrive: drive_v3.Drive | null = null;

function getServiceAccountJson() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) {
    throw new Error("Missing env GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  }
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as {
    client_email: string;
    private_key: string;
    project_id?: string;
  };
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

