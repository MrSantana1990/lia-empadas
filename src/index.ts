import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext, getRoleFromRequest } from "./context";
import { appRouter } from "./routers";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  // Healthcheck
  app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).json({ ok: true });
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
