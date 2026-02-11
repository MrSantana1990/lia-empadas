import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { z } from "zod";
import { clearAdminCookie, setAdminCookie } from "./context";
import { getDriveClient } from "./driveClient";
import { DriveEntityStore, ensureFolder } from "./driveEntityStore";
import {
  AccountItemSchema,
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
  const secret = requiredEnv("JWT_SECRET");
  return jwt.sign({ role: "admin" }, secret, { expiresIn: "7d" });
}

function getFinanceFolderId() {
  return requiredEnv("GOOGLE_DRIVE_ADMIN_FOLDER_ID");
}

type FinanceStores = {
  categories: DriveEntityStore<z.infer<typeof CategorySchema>>;
  transactions: DriveEntityStore<z.infer<typeof TransactionSchema>>;
  accounts: DriveEntityStore<z.infer<typeof AccountItemSchema>>;
};

let financeStoresPromise: Promise<FinanceStores> | null = null;

async function getFinanceStores(): Promise<FinanceStores> {
  if (financeStoresPromise) return financeStoresPromise;

  financeStoresPromise = (async () => {
    const drive = getDriveClient();
    const root = getFinanceFolderId();

    const categoriesFolder = await ensureFolder(drive, root, "finance_categories");
    const transactionsFolder = await ensureFolder(drive, root, "finance_transactions");
    const accountsFolder = await ensureFolder(drive, root, "finance_accounts");

    return {
      categories: new DriveEntityStore(drive, categoriesFolder, CategorySchema),
      transactions: new DriveEntityStore(drive, transactionsFolder, TransactionSchema),
      accounts: new DriveEntityStore(drive, accountsFolder, AccountItemSchema),
    };
  })();

  return financeStoresPromise;
}

const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(({ input, ctx }) => {
      const username = requiredEnv("ADMIN_USERNAME");
      const password = requiredEnv("ADMIN_PASSWORD");

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

const financeRouter = router({
  categories: router({
    list: adminProcedure.query(async () => {
      const { categories } = await getFinanceStores();
      const items = await categories.list();
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
        const { categories } = await getFinanceStores();
        await categories.put(item.id, item);
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
        const { categories } = await getFinanceStores();
        const existing = await categories.get(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = CategorySchema.parse({ ...existing, ...input.data, id: input.id });
        await categories.put(input.id, updated);
        return { item: updated };
      }),
    delete: adminProcedure
      .input(z.object({ id: zId }))
      .mutation(async ({ input }) => {
        const { categories, transactions } = await getFinanceStores();
        const tx = await transactions.list();
        const inUse = tx.some(t => t.categoryId === input.id);
        if (inUse) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Não é possível excluir: existem lançamentos usando esta categoria. Reclassifique os lançamentos e tente novamente.",
          });
        }
        await categories.delete(input.id);
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
        const { transactions } = await getFinanceStores();
        const list = await transactions.list();
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
        const { transactions } = await getFinanceStores();
        await transactions.put(item.id, item);
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
        const { transactions } = await getFinanceStores();
        const existing = await transactions.get(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = TransactionSchema.parse({ ...existing, ...input.data, id: input.id });
        await transactions.put(input.id, updated);
        return { item: updated };
      }),

    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { transactions } = await getFinanceStores();
      await transactions.delete(input.id);
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
        const { transactions } = await getFinanceStores();
        const existing = await transactions.get(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = TransactionSchema.parse({
          ...existing,
          status: "CONFIRMED",
          paymentMethod: input.paymentMethod ?? existing.paymentMethod,
        });
        await transactions.put(input.id, updated);
        return { item: updated };
      }),

    cancel: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { transactions } = await getFinanceStores();
      const existing = await transactions.get(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = TransactionSchema.parse({ ...existing, status: "CANCELED" });
      await transactions.put(input.id, updated);
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
          const { transactions, categories } = await getFinanceStores();
          const tx = await transactions.list();
          const cats = await categories.list();
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
      const { accounts } = await getFinanceStores();
      const items = await accounts.list();
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
        const { accounts } = await getFinanceStores();
        await accounts.put(item.id, item);
        return { item };
      }),
    update: adminProcedure
      .input(z.object({ id: zId, data: AccountItemSchema.partial().omit({ id: true }) }))
      .mutation(async ({ input }) => {
        const { accounts } = await getFinanceStores();
        const existing = await accounts.get(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = AccountItemSchema.parse({ ...existing, ...input.data, id: input.id });
        await accounts.put(input.id, updated);
        return { item: updated };
      }),
    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { accounts } = await getFinanceStores();
      await accounts.delete(input.id);
      return { ok: true };
    }),
    pay: adminProcedure
      .input(z.object({ id: zId, paymentMethod: PaymentMethodSchema.optional() }))
      .mutation(async ({ input }) => {
        const { accounts } = await getFinanceStores();
        const existing = await accounts.get(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = AccountItemSchema.parse({ ...existing, status: "PAID" });
        await accounts.put(input.id, updated);
        return { item: updated };
      }),
  }),

  dashboard: router({
    summary: adminProcedure
      .input(z.object({ from: z.string(), to: z.string() }))
      .query(async ({ input }) => {
        const { transactions, categories } = await getFinanceStores();
        const tx = await transactions.list();
        const cats = await categories.list();
        const catMap = new Map(cats.map(c => [c.id, c.name]));

        const inRange = tx.filter(t => t.dateISO >= input.from && t.dateISO <= input.to);

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
          range: { from: input.from, to: input.to },
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
  finance: financeRouter,
});

export type AppRouter = typeof appRouter;
