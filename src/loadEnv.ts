import fs from "node:fs";
import path from "node:path";

function parseEnvFile(contents: string) {
  const out: Record<string, string> = {};
  const lines = contents.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function findRepoRoot(startDir: string) {
  let current = startDir;
  for (let i = 0; i < 30; i++) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) return current;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function readTextFileSmart(fullPath: string) {
  const buf = fs.readFileSync(fullPath);
  if (buf.length >= 2) {
    // UTF-16 LE often includes lots of NUL bytes when read as bytes.
    const hasNul = buf.includes(0);
    if (hasNul) return buf.toString("utf16le").replace(/^\uFEFF/, "");
  }

  // Default: UTF-8 (strip BOM if present)
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

function safePathCandidatesFromEnv(): string[] {
  const keys = [
    "NETLIFY_DEV_BASE",
    "NETLIFY_BUILD_BASE",
    "NETLIFY_WORKDIR",
    "INIT_CWD",
    "PWD",
    "PROJECT_DIR",
    "APPDATA",
    "USERPROFILE",
    "LAMBDA_TASK_ROOT",
  ];

  const out: string[] = [];
  for (const key of keys) {
    const v = process.env[key];
    if (!v) continue;
    if (typeof v !== "string") continue;
    if (!path.isAbsolute(v)) continue;
    out.push(v);
  }
  return out;
}

/**
 * Loads local env files for development.
 *
 * Netlify production already injects env vars at runtime; this is mainly
 * for `netlify dev` / local usage (and it is safe if files don't exist).
 */
export function loadEnvFiles() {
  const envCandidates = safePathCandidatesFromEnv();
  const rootCandidates = [
    findRepoRoot(process.cwd()),
    ...envCandidates.map((p) => findRepoRoot(p)),
    process.cwd(),
  ].filter(Boolean) as string[];

  const uniqueRoots = [...new Set(rootCandidates)];
  const candidates = [".env.local", ".env"];

  for (const root of uniqueRoots) {
    for (const file of candidates) {
      const fullPath = path.join(root, file);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const parsed = parseEnvFile(readTextFileSmart(fullPath));
        for (const [k, v] of Object.entries(parsed)) {
          if (process.env[k] === undefined) process.env[k] = v;
        }
      } catch {
        // Keep silent: never log env file contents.
      }
    }
  }
}
