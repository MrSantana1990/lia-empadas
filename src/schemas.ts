import { z } from "zod";
import { zId } from "./trpc";

export const PaymentMethodSchema = z.enum(["PIX", "DINHEIRO", "CARTAO"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const TransactionTypeSchema = z.enum(["IN", "OUT", "ADJUST"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELED"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const CategoryKindSchema = z.enum(["IN", "OUT", "BOTH"]);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const TransactionSourceSchema = z.enum(["manual", "checkout"]);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const CategorySchema = z.object({
  id: zId,
  name: z.string().min(1),
  kind: CategoryKindSchema,
});
export type Category = z.infer<typeof CategorySchema>;

export const TransactionSchema = z.object({
  id: zId,
  type: TransactionTypeSchema,
  status: TransactionStatusSchema,
  dateISO: z.string().min(1),
  amount: z.number(),
  categoryId: zId,
  paymentMethod: PaymentMethodSchema,
  description: z.string().min(1),
  source: TransactionSourceSchema,
  reference: z.string().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const AccountKindSchema = z.enum(["PAYABLE", "RECEIVABLE"]);
export type AccountKind = z.infer<typeof AccountKindSchema>;

export const AccountStatusSchema = z.enum(["OPEN", "PAID", "CANCELED"]);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const AccountItemSchema = z.object({
  id: zId,
  kind: AccountKindSchema,
  dueDateISO: z.string().min(1),
  amount: z.number(),
  status: AccountStatusSchema,
  notes: z.string().optional(),
});
export type AccountItem = z.infer<typeof AccountItemSchema>;

