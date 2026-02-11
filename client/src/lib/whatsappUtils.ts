import { PIX_KEY, WHATSAPP_API_URL } from "@/const";
import type { CartItem } from "@/hooks/useCart";

export type DeliveryMethod = "delivery" | "hand";
export type PaymentMethod = "pix" | "cash" | "card";

export function sendOnDemandRequest({
  productName,
  quantity,
}: {
  productName: string;
  quantity: number;
}) {
  const lines: string[] = [
    "📦 *SOLICITAÇÃO SOB DEMANDA - EMPADAS DA LIA*",
    "",
    `Sabor: ${productName}`,
    `Quantidade: ${quantity} unidade(s)`,
    "",
    "Pode me confirmar disponibilidade e prazo?",
    "",
    `Solicitado em: ${new Date().toLocaleString("pt-BR")}`,
  ];

  const url = `${WHATSAPP_API_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "width=800,height=600");
}

export interface OrderDetails {
  items: CartItem[];
  total: number;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  customerAddress?: string;
  deliveryDate?: string;
  notes?: string;
}

function deliveryMethodLabel(method: DeliveryMethod) {
  if (method === "hand") return "Em mãos (eu mesmo levo)";
  return "Entrega no endereço";
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === "pix") return "PIX (adiantado)";
  if (method === "card") return "Cartão na entrega";
  return "Dinheiro na entrega";
}

/**
 * Gera uma mensagem formatada para o WhatsApp com os detalhes do pedido
 */
export function generateOrderMessage(order: OrderDetails): string {
  const address = order.customerAddress || "";
  const addressLine =
    order.deliveryMethod === "delivery"
      ? address
        ? `Endereço: ${address}`
        : ""
      : address
        ? `Local/Referência: ${address}`
        : "";

  const lines: string[] = [
    "🍽️ *NOVO PEDIDO - EMPADAS DA LIA*",
    "",
    "📋 *ITENS:*",
    ...order.items.map(
      item => `• ${item.name} — ${item.quantity}x (${formatPrice(item.price)})`
    ),
    "",
    `💰 *TOTAL: ${formatPrice(order.total)}*`,
    "",
    "🚚 *ENTREGA:*",
    deliveryMethodLabel(order.deliveryMethod),
    ...(addressLine ? [addressLine] : []),
    ...(order.deliveryDate ? [`Data de entrega: ${order.deliveryDate}`] : []),
    "",
    "💳 *PAGAMENTO:*",
    paymentMethodLabel(order.paymentMethod),
    ...(order.paymentMethod === "pix" && PIX_KEY ? [`Chave PIX: ${PIX_KEY}`] : []),
    "",
    "👤 *CLIENTE:*",
    `Nome: ${order.customerName}`,
    `Telefone: ${order.customerPhone}`,
    ...(order.notes ? [`Observações: ${order.notes}`] : []),
    "",
    `Pedido realizado em: ${new Date().toLocaleString("pt-BR")}`,
  ];

  return lines.join("\n");
}

/**
 * Gera a URL de WhatsApp com a mensagem do pedido
 */
export function generateWhatsAppURL(order: OrderDetails): string {
  const message = generateOrderMessage(order);
  const encodedMessage = encodeURIComponent(message);
  return `${WHATSAPP_API_URL}?text=${encodedMessage}`;
}

/**
 * Abre o WhatsApp com a mensagem do pedido em uma nova aba
 */
export function sendOrderToWhatsApp(order: OrderDetails): void {
  const url = generateWhatsAppURL(order);
  window.open(url, "_blank", "width=800,height=600");
}

/**
 * Formata preço em Real Brasileiro
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

/**
 * Formata data para formato brasileiro
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
