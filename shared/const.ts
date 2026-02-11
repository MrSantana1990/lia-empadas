export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

// Configuração de WhatsApp
export const WHATSAPP_NUMBER = "5571987922212"; // Número da mãe (Lia)
export const WHATSAPP_API_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

// Pagamento (opcional)
// - Se você usar PIX adiantado, coloque aqui a sua chave para aparecer no pedido.
export const PIX_KEY = "";

// Produtos disponíveis
export const PRODUCTS = [
  {
    id: "empada-frango",
    name: "Empada de Frango",
    description:
      "Empada tradicional recheada com frango desfiado e tempero caseiro",
    price: 10,
    image: "/images/products/empada-frango.jpg",
    category: "classic",
    availability: "available",
  },
  {
    id: "empada-palmito",
    name: "Empada de Palmito",
    description: "Empada delicada com palmito fresco e cream cheese",
    price: 10,
    image: "/images/products/empada-palmito.jpg",
    category: "premium",
    availability: "available",
  },
  {
    id: "empada-camarao",
    name: "Empada de Camarão",
    description: "Empada sofisticada com camarão fresco e tempero especial",
    price: 10,
    image: "/images/products/empada-camarao.jpg",
    category: "premium",
    availability: "available",
  },
  {
    id: "empada-queijo",
    name: "Empada de Queijo",
    description: "Empada com queijo meia cura e ervas finas",
    price: 10,
    image: "/images/products/empada-queijo.jpg",
    category: "classic",
    availability: "available",
  },
  {
    id: "empada-cogumelo",
    name: "Empada de Cogumelo",
    description: "Empada vegetariana com cogumelo fresco e alho",
    price: 10,
    image: "/images/products/empada-cogumelo.jpg",
    category: "vegetarian",
    availability: "available",
  },
  {
    id: "empada-carne",
    name: "Empada de Carne Seca",
    description: "Empada com carne seca desfiada e cebola caramelizada",
    price: 10,
    image: "/images/products/empada-carne.jpg",
    category: "classic",
    availability: "available",
  },
] as const;

// Categorias
export const CATEGORIES = [
  { id: "all", name: "Todos os Sabores" },
  { id: "classic", name: "Clássicas" },
  { id: "premium", name: "Premium" },
  { id: "vegetarian", name: "Vegetarianas" },
] as const;

// Quantidades mínimas e máximas
export const MIN_ORDER_QUANTITY = 1;
export const MAX_ORDER_QUANTITY = 100;
export const DEFAULT_ORDER_QUANTITY = 12;

// Mensagens
export const MESSAGES = {
  welcome: "Bem-vindo às Empadas da Lia!",
  selectProducts: "Selecione seus sabores favoritos",
  addToCart: "Adicionar ao carrinho",
  viewCart: "Ver carrinho",
  checkout: "Finalizar pedido",
  orderSent: "Pedido enviado com sucesso!",
  minOrder: `Quantidade mínima: ${MIN_ORDER_QUANTITY} unidades`,
  maxOrder: `Quantidade máxima: ${MAX_ORDER_QUANTITY} unidades`,
} as const;
