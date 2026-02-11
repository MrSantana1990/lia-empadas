import { z } from "zod";

export const CategoryKindSchema = z.enum(["IN", "OUT", "BOTH"]);
export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: CategoryKindSchema,
});
export type Category = z.infer<typeof CategorySchema>;

export const PaymentMethodSchema = z.enum(["PIX", "DINHEIRO", "CARTAO"]);
export const TransactionTypeSchema = z.enum(["IN", "OUT", "ADJUST"]);
export const TransactionStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELED",
]);

export const TransactionSchema = z.object({
  id: z.string().min(1),
  type: TransactionTypeSchema,
  status: TransactionStatusSchema,
  dateISO: z.string().min(1),
  amount: z.number(),
  categoryId: z.string().min(1),
  paymentMethod: PaymentMethodSchema,
  description: z.string().min(1),
  source: z.enum(["manual", "checkout"]),
  reference: z.string().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const AccountKindSchema = z.enum(["PAYABLE", "RECEIVABLE"]);
export const AccountStatusSchema = z.enum(["OPEN", "PAID", "CANCELED"]);

export const AccountItemSchema = z.object({
  id: z.string().min(1),
  kind: AccountKindSchema,
  dueDateISO: z.string().min(1),
  amount: z.number(),
  status: AccountStatusSchema,
  notes: z.string().optional(),
});
export type AccountItem = z.infer<typeof AccountItemSchema>;

