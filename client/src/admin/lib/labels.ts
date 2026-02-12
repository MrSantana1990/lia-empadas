import type {
  AccountItem,
  Category,
  Transaction,
} from "../schemas";

export const paymentMethodLabel: Record<Transaction["paymentMethod"], string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
};

export const transactionTypeLabel: Record<Transaction["type"], string> = {
  IN: "Entrada",
  OUT: "Saída (compras)",
  ADJUST: "Ajuste",
};

export const transactionStatusLabel: Record<Transaction["status"], string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELED: "Cancelado",
};

export const categoryKindLabel: Record<Category["kind"], string> = {
  IN: "Entrada",
  OUT: "Saída",
  BOTH: "Ambos",
};

export const accountKindLabel: Record<AccountItem["kind"], string> = {
  PAYABLE: "A pagar",
  RECEIVABLE: "A receber",
};

export const accountStatusLabel: Record<AccountItem["status"], string> = {
  OPEN: "Em aberto",
  PAID: "Pago",
  CANCELED: "Cancelado",
};

export type ProductAvailability = "available" | "on_demand" | "unavailable";

export const productAvailabilityLabel: Record<ProductAvailability, string> = {
  available: "Disponível",
  on_demand: "Sob demanda",
  unavailable: "Indisponível",
};
