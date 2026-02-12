import fs from "node:fs";
import path from "node:path";

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

function safeAbsoluteCandidatesFromEnv(): string[] {
  const keys = [
    "NETLIFY_DEV_BASE",
    "NETLIFY_BUILD_BASE",
    "NETLIFY_WORKDIR",
    "INIT_CWD",
    "PWD",
    "PROJECT_DIR",
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
 * Returns a stable directory for local dev data.
 *
 * Important: `netlify dev` runs functions from a temp directory, so `process.cwd()`
 * is not stable. We try to find the real repo root from known env vars.
 */
export function getLocalDataRootDir() {
  const envCandidates = safeAbsoluteCandidatesFromEnv();
  const rootCandidates = [
    findRepoRoot(process.cwd()),
    ...envCandidates.map((p) => findRepoRoot(p)),
    process.cwd(),
  ].filter(Boolean) as string[];

  const root = rootCandidates[0] ?? process.cwd();
  return path.join(root, ".local-data");
}

