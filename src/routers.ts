import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import path from "node:path";
import { z } from "zod";
import { PRODUCTS as DEFAULT_PRODUCTS } from "../shared/const";
import { clearAdminCookie, setAdminCookie } from "./context";
import { getDriveClient, getServiceAccountEmailSafe } from "./driveClient";
import { DriveEntityStore, ensureFolder } from "./driveEntityStore";
import { HybridEntityStore } from "./hybridEntityStore";
import { getLocalDataRootDir } from "./localDataRoot";
import { LocalEntityStore } from "./localEntityStore";
import {
  AccountItemSchema,
  CatalogProductOverrideSchema,
  ProductAvailabilitySchema,
  CategorySchema,
  PaymentMethodSchema,
  TransactionSchema,
} from "./schemas";
import { adminProcedure, publicProcedure, router, zId } from "./trpc";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function signAdminJwt() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Variável de ambiente faltando: JWT_SECRET.",
    });
  }
  return jwt.sign({ role: "admin" }, secret, { expiresIn: "7d" });
}

function getFinanceFolderId() {
  return requiredEnv("GOOGLE_DRIVE_ADMIN_FOLDER_ID");
}

type FinanceStores = {
  categories: HybridEntityStore<z.infer<typeof CategorySchema>>;
  transactions: HybridEntityStore<z.infer<typeof TransactionSchema>>;
  accounts: HybridEntityStore<z.infer<typeof AccountItemSchema>>;
};

let financeStoresPromise: Promise<FinanceStores> | null = null;

async function getFinanceStores(): Promise<FinanceStores> {
  if (financeStoresPromise) return financeStoresPromise;

  financeStoresPromise = (async () => {
    const drive = getDriveClient();
    const root = getFinanceFolderId();
    // IMPORTANT: never write to local filesystem in Netlify production (read-only).
    // Enable local fallback only for local development (`netlify dev`) or non-Netlify runs.
    const devFallbackEnabled = process.env.NETLIFY_DEV === "true" || !process.env.NETLIFY;
    const localRoot = getLocalDataRootDir();

    let usePrefixes = false;
    let categoriesFolder = root;
    let transactionsFolder = root;
    let accountsFolder = root;

    try {
      categoriesFolder = await ensureFolder(drive, root, "finance_categories");
      transactionsFolder = await ensureFolder(drive, root, "finance_transactions");
      accountsFolder = await ensureFolder(drive, root, "finance_accounts");
    } catch {
      // Fallback: keep everything in the root folder using filename prefixes.
      // This avoids "folder create" permission issues while still staying Drive-first.
      usePrefixes = true;
      categoriesFolder = root;
      transactionsFolder = root;
      accountsFolder = root;
    }

    return {
      categories: new HybridEntityStore(
        new DriveEntityStore(drive, categoriesFolder, CategorySchema, {
          filePrefix: usePrefixes ? "finance_categories__" : undefined,
        }),
        new LocalEntityStore(
          path.join(localRoot, "finance_categories"),
          CategorySchema,
          usePrefixes ? { filePrefix: "finance_categories__" } : undefined
        ),
        CategorySchema,
        { devFallbackEnabled }
      ),
      transactions: new HybridEntityStore(
        new DriveEntityStore(drive, transactionsFolder, TransactionSchema, {
          filePrefix: usePrefixes ? "finance_transactions__" : undefined,
        }),
        new LocalEntityStore(
          path.join(localRoot, "finance_transactions"),
          TransactionSchema,
          usePrefixes ? { filePrefix: "finance_transactions__" } : undefined
        ),
        TransactionSchema,
        { devFallbackEnabled }
      ),
      accounts: new HybridEntityStore(
        new DriveEntityStore(drive, accountsFolder, AccountItemSchema, {
          filePrefix: usePrefixes ? "finance_accounts__" : undefined,
        }),
        new LocalEntityStore(
          path.join(localRoot, "finance_accounts"),
          AccountItemSchema,
          usePrefixes ? { filePrefix: "finance_accounts__" } : undefined
        ),
        AccountItemSchema,
        { devFallbackEnabled }
      ),
    };
  })();

  return financeStoresPromise;
}

function describeDriveError(err: unknown) {
  const e = err as any;
  const status = e?.response?.status ?? e?.code;
  const msg = e?.response?.data?.error?.message ?? e?.message;
  const pieces: string[] = [];
  if (status) pieces.push(`status ${status}`);
  if (msg) pieces.push(String(msg).slice(0, 240));
  return pieces.length > 0 ? pieces.join(" - ") : "erro desconhecido";
}

function isServiceAccountNoQuotaError(err: unknown) {
  const e = err as any;
  const msg = e?.response?.data?.error?.message ?? e?.message ?? "";
  return typeof msg === "string" && msg.includes("Service Accounts do not have storage quota");
}

function serviceAccountNoQuotaHelp(scope: string) {
  const sa = getServiceAccountEmailSafe();
  const saLine = sa ? ` Service account: ${sa}.` : "";
  return (
    `Não foi possível gravar no Google Drive (${scope}).` +
    saLine +
    " Isso acontece quando a pasta está em um Drive pessoal (Meu Drive) e a autenticação é via Service Account (sem quota)." +
    " Solução recomendada: crie/Use um Shared Drive (Google Workspace), adicione a service account como membro (Content manager/Editor)," +
    " crie uma pasta lá e atualize GOOGLE_DRIVE_ADMIN_FOLDER_ID para a nova pasta."
  );
}

function driveConfigHelp(scope: string, err?: unknown) {
  const detail =
    process.env.NODE_ENV === "production" || !err
      ? ""
      : ` Detalhe: ${describeDriveError(err)}.`;
  return (
    `Falha ao acessar o Google Drive (${scope}). ` +
    "Verifique se as env vars GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 e GOOGLE_DRIVE_ADMIN_FOLDER_ID estão configuradas " +
    "e se a service account tem permissão de Editor na pasta do Drive." +
    detail
  );
}

async function withDrive<T>(scope: string, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (isServiceAccountNoQuotaError(err)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: serviceAccountNoQuotaHelp(scope),
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: driveConfigHelp(scope, err),
    });
  }
}

async function getFinanceStoresOrThrow(): Promise<FinanceStores> {
  try {
    return await getFinanceStores();
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: driveConfigHelp("financeiro", err),
    });
  }
}

let catalogOverridesStorePromise:
  | Promise<HybridEntityStore<z.infer<typeof CatalogProductOverrideSchema>>>
  | null = null;

async function getCatalogOverridesStore() {
  if (catalogOverridesStorePromise) return catalogOverridesStorePromise;

  catalogOverridesStorePromise = (async () => {
    const drive = getDriveClient();
    const root = requiredEnv("GOOGLE_DRIVE_ADMIN_FOLDER_ID");
    // IMPORTANT: never write to local filesystem in Netlify production (read-only).
    const devFallbackEnabled = process.env.NETLIFY_DEV === "true" || !process.env.NETLIFY;
    const localRoot = getLocalDataRootDir();

    try {
      const productsFolder = await ensureFolder(drive, root, "catalog_products");
      return new HybridEntityStore(
        new DriveEntityStore(drive, productsFolder, CatalogProductOverrideSchema),
        new LocalEntityStore(path.join(localRoot, "catalog_products"), CatalogProductOverrideSchema),
        CatalogProductOverrideSchema,
        { devFallbackEnabled }
      );
    } catch {
      // Fallback: no folder creation. Store overrides in the root folder with a prefix.
      return new HybridEntityStore(
        new DriveEntityStore(drive, root, CatalogProductOverrideSchema, {
          filePrefix: "catalog_products__",
        }),
        new LocalEntityStore(path.join(localRoot, "catalog_products"), CatalogProductOverrideSchema, {
          filePrefix: "catalog_products__",
        }),
        CatalogProductOverrideSchema,
        { devFallbackEnabled }
      );
    }
  })();

  return catalogOverridesStorePromise;
}

const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(({ input, ctx }) => {
      const envUsername = process.env.ADMIN_USERNAME;
      const envPassword = process.env.ADMIN_PASSWORD;
      const missing = ["JWT_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD"].filter(
        (k) => !process.env[k]
      );
      if (missing.length > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Variáveis de ambiente faltando (local): " +
            missing.join(", ") +
            ". Crie um arquivo `.env` ou `.env.local` na raiz do projeto e reinicie `pnpm netlify dev`.",
        });
      }

      const username = envUsername as string;
      const password = envPassword as string;

      if (input.username !== username || input.password !== password) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const token = signAdminJwt();
      setAdminCookie(ctx.res, token);
      return { ok: true, role: "admin" as const };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearAdminCookie(ctx.res);
    return { ok: true };
  }),

  me: publicProcedure.query(({ ctx }) => {
    if (ctx.role !== "admin") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return { role: "admin" as const };
  }),
});

const catalogRouter = router({
  products: router({
    list: publicProcedure.query(async () => {
      let overrides: z.infer<typeof CatalogProductOverrideSchema>[] = [];
      try {
        const store = await getCatalogOverridesStore();
        overrides = await store.list();
      } catch {
        overrides = [];
      }

      const overrideMap = new Map(overrides.map(o => [o.id, o]));
      const items = DEFAULT_PRODUCTS.map(p => {
        const override = overrideMap.get(p.id);
        return {
          ...p,
          price: override?.price ?? p.price,
          availability: override?.availability ?? p.availability ?? "available",
        };
      });

      return { items };
    }),

    update: adminProcedure
      .input(
        z.object({
          id: zId,
          price: z.number().min(0).optional(),
          availability: ProductAvailabilitySchema.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const store = await withDrive("catálogo", () => getCatalogOverridesStore());
        await withDrive("catálogo", () =>
          store.put(input.id, {
            price: input.price,
            availability: input.availability,
          })
        );
        return { ok: true };
      }),

    reset: adminProcedure
      .input(z.object({ id: zId }))
      .mutation(async ({ input }) => {
        const store = await withDrive("catálogo", () => getCatalogOverridesStore());
        await withDrive("catálogo", () => store.delete(input.id));
        return { ok: true };
      }),
  }),
});

const financeRouter = router({
  categories: router({
    list: adminProcedure.query(async () => {
      const { categories } = await getFinanceStoresOrThrow();
      const items = await withDrive("financeiro", () => categories.list());
      return { items };
    }),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), kind: CategorySchema.shape.kind }))
      .mutation(async ({ input }) => {
        const item = CategorySchema.parse({
          id: nanoid(),
          name: input.name,
          kind: input.kind,
        });
        const { categories } = await getFinanceStoresOrThrow();
        await withDrive("financeiro", () => categories.put(item.id, item));
        return { item };
      }),
    update: adminProcedure
      .input(
        z.object({
          id: zId,
          data: z.object({
            name: z.string().min(1).optional(),
            kind: CategorySchema.shape.kind.optional(),
          }),
        })
      )
      .mutation(async ({ input }) => {
        const { categories } = await getFinanceStoresOrThrow();
        const existing = await withDrive("financeiro", () => categories.get(input.id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = CategorySchema.parse({ ...existing, ...input.data, id: input.id });
        await withDrive("financeiro", () => categories.put(input.id, updated));
        return { item: updated };
      }),
    delete: adminProcedure
      .input(z.object({ id: zId }))
      .mutation(async ({ input }) => {
        const { categories, transactions } = await getFinanceStoresOrThrow();
        const tx = await withDrive("financeiro", () => transactions.list());
        const inUse = tx.some(t => t.categoryId === input.id);
        if (inUse) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Não é possível excluir: existem lançamentos usando esta categoria. Reclassifique os lançamentos e tente novamente.",
          });
        }
        await withDrive("financeiro", () => categories.delete(input.id));
        return { ok: true };
      }),
  }),

  transactions: router({
    list: adminProcedure
      .input(
        z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
            status: TransactionSchema.shape.status.optional(),
            type: TransactionSchema.shape.type.optional(),
            categoryId: zId.optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const { transactions } = await getFinanceStoresOrThrow();
        const list = await withDrive("financeiro", () => transactions.list());
        const from = input?.from;
        const to = input?.to;
        const status = input?.status;
        const type = input?.type;
        const categoryId = input?.categoryId;

        const items = list.filter(t => {
          if (status && t.status !== status) return false;
          if (type && t.type !== type) return false;
          if (categoryId && t.categoryId !== categoryId) return false;
          if (from && t.dateISO < from) return false;
          if (to && t.dateISO > to) return false;
          return true;
        });
        items.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
        return { items };
      }),

    create: adminProcedure
      .input(
        TransactionSchema.omit({ id: true, status: true }).extend({
          status: TransactionSchema.shape.status.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const item = TransactionSchema.parse({
          ...input,
          id: nanoid(),
          status: input.status ?? "PENDING",
        });
        const { transactions } = await getFinanceStoresOrThrow();
        await withDrive("financeiro", () => transactions.put(item.id, item));
        return { item };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: zId,
          data: TransactionSchema.partial().omit({ id: true }),
        })
      )
      .mutation(async ({ input }) => {
        const { transactions } = await getFinanceStoresOrThrow();
        const existing = await withDrive("financeiro", () => transactions.get(input.id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = TransactionSchema.parse({ ...existing, ...input.data, id: input.id });
        await withDrive("financeiro", () => transactions.put(input.id, updated));
        return { item: updated };
      }),

    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { transactions } = await getFinanceStoresOrThrow();
      await withDrive("financeiro", () => transactions.delete(input.id));
      return { ok: true };
    }),

    confirm: adminProcedure
      .input(
        z.object({
          id: zId,
          receivedAt: z.string().optional(),
          paymentMethod: PaymentMethodSchema.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { transactions } = await getFinanceStoresOrThrow();
        const existing = await withDrive("financeiro", () => transactions.get(input.id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = TransactionSchema.parse({
          ...existing,
          status: "CONFIRMED",
          paymentMethod: input.paymentMethod ?? existing.paymentMethod,
        });
        await withDrive("financeiro", () => transactions.put(input.id, updated));
        return { item: updated };
      }),

    cancel: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { transactions } = await getFinanceStoresOrThrow();
      const existing = await withDrive("financeiro", () => transactions.get(input.id));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = TransactionSchema.parse({ ...existing, status: "CANCELED" });
      await withDrive("financeiro", () => transactions.put(input.id, updated));
      return { item: updated };
    }),

    export: router({
      csv: adminProcedure
        .input(
          z
            .object({ from: z.string().optional(), to: z.string().optional() })
            .optional()
        )
        .query(async ({ input }) => {
          const { transactions, categories } = await getFinanceStoresOrThrow();
          const tx = await withDrive("financeiro", () => transactions.list());
          const cats = await withDrive("financeiro", () => categories.list());
          const catMap = new Map(cats.map(c => [c.id, c.name]));

          const from = input?.from;
          const to = input?.to;
          const filtered = tx.filter(t => {
            if (from && t.dateISO < from) return false;
            if (to && t.dateISO > to) return false;
            return true;
          });

          const header = [
            "id",
            "type",
            "status",
            "dateISO",
            "amount",
            "categoryId",
            "categoryName",
            "paymentMethod",
            "description",
            "source",
            "reference",
          ];

          const rows = filtered.map(t => [
            t.id,
            t.type,
            t.status,
            t.dateISO,
            String(t.amount),
            t.categoryId,
            catMap.get(t.categoryId) ?? "",
            t.paymentMethod,
            t.description.replaceAll('"', '""'),
            t.source,
            t.reference ?? "",
          ]);

          const csv =
            header.join(",") +
            "\n" +
            rows.map(r => r.map(v => `"${String(v)}"`).join(",")).join("\n");

          return { csv };
        }),
    }),
  }),

  accounts: router({
    list: adminProcedure.query(async () => {
      const { accounts } = await getFinanceStoresOrThrow();
      const items = await withDrive("financeiro", () => accounts.list());
      items.sort((a, b) => (a.dueDateISO < b.dueDateISO ? -1 : 1));
      return { items };
    }),
    create: adminProcedure
      .input(
        AccountItemSchema.omit({ id: true, status: true }).extend({
          status: AccountItemSchema.shape.status.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const item = AccountItemSchema.parse({
          ...input,
          id: nanoid(),
          status: input.status ?? "OPEN",
        });
        const { accounts } = await getFinanceStoresOrThrow();
        await withDrive("financeiro", () => accounts.put(item.id, item));
        return { item };
      }),
    update: adminProcedure
      .input(z.object({ id: zId, data: AccountItemSchema.partial().omit({ id: true }) }))
      .mutation(async ({ input }) => {
        const { accounts } = await getFinanceStoresOrThrow();
        const existing = await withDrive("financeiro", () => accounts.get(input.id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = AccountItemSchema.parse({ ...existing, ...input.data, id: input.id });
        await withDrive("financeiro", () => accounts.put(input.id, updated));
        return { item: updated };
      }),
    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { accounts } = await getFinanceStoresOrThrow();
      await withDrive("financeiro", () => accounts.delete(input.id));
      return { ok: true };
    }),
    pay: adminProcedure
      .input(z.object({ id: zId, paymentMethod: PaymentMethodSchema.optional() }))
      .mutation(async ({ input }) => {
        const { accounts } = await getFinanceStoresOrThrow();
        const existing = await withDrive("financeiro", () => accounts.get(input.id));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = AccountItemSchema.parse({ ...existing, status: "PAID" });
        await withDrive("financeiro", () => accounts.put(input.id, updated));
        return { item: updated };
      }),
  }),

  dashboard: router({
    summary: adminProcedure
      .input(
        z
          .object({
            from: z.string().min(1).optional(),
            to: z.string().min(1).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const { transactions, categories } = await getFinanceStoresOrThrow();
        const tx = await withDrive("financeiro", () => transactions.list());
        const cats = await withDrive("financeiro", () => categories.list());
        const catMap = new Map(cats.map(c => [c.id, c.name]));

        const from = input?.from;
        const to = input?.to;

        const inRange = tx.filter(t => {
          if (from && t.dateISO < from) return false;
          if (to && t.dateISO > to) return false;
          return true;
        });

        const confirmed = inRange.filter(t => t.status === "CONFIRMED");
        const pending = inRange.filter(t => t.status === "PENDING");

        const inConfirmed = confirmed
          .filter(t => t.type === "IN")
          .reduce((s, t) => s + t.amount, 0);
        const outConfirmed = confirmed
          .filter(t => t.type === "OUT")
          .reduce((s, t) => s + t.amount, 0);
        const adjustConfirmed = confirmed
          .filter(t => t.type === "ADJUST")
          .reduce((s, t) => s + t.amount, 0);

        const pendingAmount = pending.reduce((s, t) => s + t.amount, 0);

        const byCategoryMap = new Map<string, number>();
        for (const t of confirmed) {
          const sign = t.type === "OUT" ? -1 : 1;
          byCategoryMap.set(t.categoryId, (byCategoryMap.get(t.categoryId) ?? 0) + sign * t.amount);
        }
        const byCategory = [...byCategoryMap.entries()]
          .map(([categoryId, total]) => ({
            categoryId,
            categoryName: catMap.get(categoryId) ?? "Sem categoria",
            total,
          }))
          .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
          .slice(0, 5);

        const byPaymentMap = new Map<string, number>();
        for (const t of confirmed) {
          const sign = t.type === "OUT" ? -1 : 1;
          byPaymentMap.set(
            t.paymentMethod,
            (byPaymentMap.get(t.paymentMethod) ?? 0) + sign * t.amount
          );
        }
        const byPayment = [...byPaymentMap.entries()].map(([method, total]) => ({
          method,
          total,
        }));

        return {
          range: { from: from ?? "", to: to ?? "" },
          totals: {
            inConfirmed,
            outConfirmed,
            balance: inConfirmed - outConfirmed + adjustConfirmed,
            pendingCount: pending.length,
            pendingAmount,
          },
          byCategory,
          byPayment,
        };
      }),
  }),
});

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  finance: financeRouter,
});

export type AppRouter = typeof appRouter;
