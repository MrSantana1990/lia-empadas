import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { z } from "zod";
import { clearAdminCookie, setAdminCookie } from "./context";
import { getDriveClient } from "./driveClient";
import { DriveJsonStore } from "./driveJsonStore";
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

function financeStores() {
  const drive = getDriveClient();
  const folderId = getFinanceFolderId();
  return {
    categories: new DriveJsonStore(drive, folderId, "finance_categories.json", [] as any[]),
    transactions: new DriveJsonStore(drive, folderId, "finance_transactions.json", [] as any[]),
    accounts: new DriveJsonStore(drive, folderId, "finance_accounts.json", [] as any[]),
  };
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
      const { categories } = financeStores();
      const raw = await categories.read();
      return z.array(CategorySchema).parse(raw);
    }),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), kind: CategorySchema.shape.kind }))
      .mutation(async ({ input }) => {
        const { categories } = financeStores();
        const list = z.array(CategorySchema).parse(await categories.read());
        const item = CategorySchema.parse({
          id: nanoid(),
          name: input.name,
          kind: input.kind,
        });
        await categories.write([...list, item]);
        return item;
      }),
    update: adminProcedure
      .input(z.object({ id: zId, name: z.string().min(1).optional(), kind: CategorySchema.shape.kind.optional() }))
      .mutation(async ({ input }) => {
        const { categories } = financeStores();
        const list = z.array(CategorySchema).parse(await categories.read());
        const idx = list.findIndex(c => c.id === input.id);
        if (idx < 0) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = CategorySchema.parse({ ...list[idx], ...input });
        const next = [...list];
        next[idx] = updated;
        await categories.write(next);
        return updated;
      }),
    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { categories } = financeStores();
      const list = z.array(CategorySchema).parse(await categories.read());
      await categories.write(list.filter(c => c.id !== input.id));
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
          })
          .optional()
      )
      .query(async ({ input }) => {
        const { transactions } = financeStores();
        const list = z.array(TransactionSchema).parse(await transactions.read());
        const from = input?.from;
        const to = input?.to;
        const status = input?.status;

        return list.filter(t => {
          if (status && t.status !== status) return false;
          if (from && t.dateISO < from) return false;
          if (to && t.dateISO > to) return false;
          return true;
        });
      }),

    create: adminProcedure
      .input(
        TransactionSchema.omit({ id: true, status: true }).extend({
          status: TransactionSchema.shape.status.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { transactions } = financeStores();
        const list = z.array(TransactionSchema).parse(await transactions.read());
        const item = TransactionSchema.parse({
          ...input,
          id: nanoid(),
          status: input.status ?? "PENDING",
        });
        await transactions.write([...list, item]);
        return item;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: zId,
          patch: TransactionSchema.partial().omit({ id: true }),
        })
      )
      .mutation(async ({ input }) => {
        const { transactions } = financeStores();
        const list = z.array(TransactionSchema).parse(await transactions.read());
        const idx = list.findIndex(t => t.id === input.id);
        if (idx < 0) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = TransactionSchema.parse({ ...list[idx], ...input.patch, id: input.id });
        const next = [...list];
        next[idx] = updated;
        await transactions.write(next);
        return updated;
      }),

    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { transactions } = financeStores();
      const list = z.array(TransactionSchema).parse(await transactions.read());
      await transactions.write(list.filter(t => t.id !== input.id));
      return { ok: true };
    }),

    confirm: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { transactions } = financeStores();
      const list = z.array(TransactionSchema).parse(await transactions.read());
      const idx = list.findIndex(t => t.id === input.id);
      if (idx < 0) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = TransactionSchema.parse({ ...list[idx], status: "CONFIRMED" });
      const next = [...list];
      next[idx] = updated;
      await transactions.write(next);
      return updated;
    }),

    export: router({
      csv: adminProcedure
        .input(
          z
            .object({ from: z.string().optional(), to: z.string().optional() })
            .optional()
        )
        .query(async ({ input }) => {
          const { transactions, categories } = financeStores();
          const tx = z.array(TransactionSchema).parse(await transactions.read());
          const cats = z.array(CategorySchema).parse(await categories.read());
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
      const { accounts } = financeStores();
      const list = await accounts.read();
      return z.array(AccountItemSchema).parse(list);
    }),
    create: adminProcedure
      .input(
        AccountItemSchema.omit({ id: true, status: true }).extend({
          status: AccountItemSchema.shape.status.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { accounts } = financeStores();
        const list = z.array(AccountItemSchema).parse(await accounts.read());
        const item = AccountItemSchema.parse({
          ...input,
          id: nanoid(),
          status: input.status ?? "OPEN",
        });
        await accounts.write([...list, item]);
        return item;
      }),
    update: adminProcedure
      .input(z.object({ id: zId, patch: AccountItemSchema.partial().omit({ id: true }) }))
      .mutation(async ({ input }) => {
        const { accounts } = financeStores();
        const list = z.array(AccountItemSchema).parse(await accounts.read());
        const idx = list.findIndex(a => a.id === input.id);
        if (idx < 0) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = AccountItemSchema.parse({ ...list[idx], ...input.patch, id: input.id });
        const next = [...list];
        next[idx] = updated;
        await accounts.write(next);
        return updated;
      }),
    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ input }) => {
      const { accounts } = financeStores();
      const list = z.array(AccountItemSchema).parse(await accounts.read());
      await accounts.write(list.filter(a => a.id !== input.id));
      return { ok: true };
    }),
    pay: adminProcedure
      .input(z.object({ id: zId, paymentMethod: PaymentMethodSchema.optional() }))
      .mutation(async ({ input }) => {
        const { accounts } = financeStores();
        const list = z.array(AccountItemSchema).parse(await accounts.read());
        const idx = list.findIndex(a => a.id === input.id);
        if (idx < 0) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = AccountItemSchema.parse({ ...list[idx], status: "PAID" });
        const next = [...list];
        next[idx] = updated;
        await accounts.write(next);
        return updated;
      }),
  }),

  dashboard: router({
    summary: adminProcedure
      .input(z.object({ from: z.string(), to: z.string() }))
      .query(async ({ input }) => {
        const { transactions } = financeStores();
        const list = z.array(TransactionSchema).parse(await transactions.read());
        const filtered = list.filter(t => {
          if (t.status !== "CONFIRMED") return false;
          if (t.dateISO < input.from) return false;
          if (t.dateISO > input.to) return false;
          return true;
        });

        const totalIn = filtered
          .filter(t => t.type === "IN")
          .reduce((s, t) => s + t.amount, 0);
        const totalOut = filtered
          .filter(t => t.type === "OUT")
          .reduce((s, t) => s + t.amount, 0);
        const totalAdjust = filtered
          .filter(t => t.type === "ADJUST")
          .reduce((s, t) => s + t.amount, 0);

        return {
          from: input.from,
          to: input.to,
          count: filtered.length,
          totalIn,
          totalOut,
          totalAdjust,
          net: totalIn - totalOut + totalAdjust,
        };
      }),
  }),
});

export const appRouter = router({
  auth: authRouter,
  finance: financeRouter,
});

export type AppRouter = typeof appRouter;
