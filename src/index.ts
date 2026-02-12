import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext, getRoleFromRequest } from "./context";
import { getDriveClient, getServiceAccountEmailSafe } from "./driveClient";
import { loadEnvFiles } from "./loadEnv";
import { appRouter } from "./routers";

// Local convenience: load `.env.local` / `.env` when present (safe no-op in production).
loadEnvFiles();

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  // Healthcheck
  app.get(["/health", "/api/health"], async (req, res) => {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      res.status(200).json({ ok: true });
      return;
    }

    const required = [
      "JWT_SECRET",
      "ADMIN_USERNAME",
      "ADMIN_PASSWORD",
      "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
      "GOOGLE_DRIVE_ADMIN_FOLDER_ID",
    ] as const;

    const present: Record<string, boolean> = {};
    for (const k of required) present[k] = Boolean(process.env[k]);

    const driveRequested =
      typeof req.query.drive === "string"
        ? req.query.drive === "1" || req.query.drive.toLowerCase() === "true"
        : false;

    let drive: null | { ok: boolean; serviceAccountEmail: string | null; error?: string } = null;
    if (driveRequested) {
      const serviceAccountEmail = getServiceAccountEmailSafe();
      try {
        const folderId = process.env.GOOGLE_DRIVE_ADMIN_FOLDER_ID;
        if (!folderId) {
          drive = { ok: false, serviceAccountEmail, error: "Missing env GOOGLE_DRIVE_ADMIN_FOLDER_ID" };
        } else {
          const d = getDriveClient();
          const folderRes = await d.files.get({
            fileId: folderId,
            fields: "id,name,mimeType",
            supportsAllDrives: true,
          });

          await d.files.list({
            q: [`'${folderId}' in parents`, "trashed=false"].join(" and "),
            fields: "files(id)",
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });

          const mimeType = folderRes.data.mimeType ?? "";
          if (mimeType && !mimeType.includes("folder")) {
            drive = {
              ok: false,
              serviceAccountEmail,
              error: "GOOGLE_DRIVE_ADMIN_FOLDER_ID não parece ser uma pasta do Drive.",
            };
          } else {
            drive = { ok: true, serviceAccountEmail };
          }
        }
      } catch (e: any) {
        const status = e?.response?.status ?? e?.code;
        const msg = e?.response?.data?.error?.message ?? e?.message ?? "Drive error";
        const safe = `${status ? `status ${status} - ` : ""}${String(msg).slice(0, 240)}`;
        drive = { ok: false, serviceAccountEmail, error: safe };
      }
    }

    res.status(200).json({
      ok: true,
      env: {
        present,
        missing: required.filter((k) => !process.env[k]),
      },
      ...(drive ? { drive } : {}),
    });
  });

  // tRPC (support both direct and /api prefix for convenience)
  app.use(
    ["/trpc", "/api/trpc"],
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Plain CSV endpoint (nice for download in browser / automation)
  app.get(
    ["/finance/transactions/export.csv", "/api/finance/transactions/export.csv"],
    async (req, res) => {
      if (getRoleFromRequest(req) !== "admin") {
        res.status(401).send("Unauthorized");
        return;
      }

      // Delegate to tRPC procedure so logic stays in one place
      const caller = appRouter.createCaller(
        createContext({ req, res })
      );
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const { csv } = await caller.finance.transactions.export.csv({ from, to });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.status(200).send(csv);
    }
  );

  return app;
}
