import { useSyncExternalStore } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

const CART_STORAGE_KEY = 'empadas-cart';

const CART_UPDATED_EVENT = "empadas-cart-updated";

const EMPTY_CART: Cart = { items: [], total: 0 };

let cachedRaw: string | null | undefined = undefined;
let cachedCart: Cart = EMPTY_CART;

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function normalizeCart(value: unknown): Cart {
  if (!value || typeof value !== "object") return EMPTY_CART;
  const maybe = value as Partial<Cart>;
  const items = Array.isArray(maybe.items) ? (maybe.items as CartItem[]) : [];
  const safeItems = items
    .filter(Boolean)
    .map(item => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 0),
      image: String(item.image ?? ""),
    }))
    .filter(item => item.id && item.quantity > 0);
  return { items: safeItems, total: calculateTotal(safeItems) };
}

function readCart(): Cart {
  if (typeof window === "undefined") return EMPTY_CART;
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (raw === cachedRaw) return cachedCart;
  cachedRaw = raw;
  if (!raw) {
    cachedCart = EMPTY_CART;
    return cachedCart;
  }
  try {
    cachedCart = normalizeCart(JSON.parse(raw));
    return cachedCart;
  } catch {
    cachedCart = EMPTY_CART;
    return cachedCart;
  }
}

function writeCart(cart: Cart) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(cart);
  cachedRaw = raw;
  cachedCart = cart;
  window.localStorage.setItem(CART_STORAGE_KEY, raw);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_UPDATED_EVENT, callback);
  };
}

export function useCart() {
  const cart = useSyncExternalStore(subscribe, readCart, () => EMPTY_CART);
  const isLoaded = typeof window !== "undefined";

  // Adicionar item ao carrinho
  const addItem = (id: string, name: string, price: number, image: string, quantity: number = 1) => {
    const current = readCart();
    const existingItem = current.items.find(item => item.id === id);

    let newItems: CartItem[];
    if (existingItem) {
      newItems = current.items.map(item =>
        item.id === id ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      newItems = [...current.items, { id, name, price, quantity, image }];
    }

    writeCart({ items: newItems, total: calculateTotal(newItems) });
  };

  // Remover item do carrinho
  const removeItem = (id: string) => {
    const current = readCart();
    const newItems = current.items.filter(item => item.id !== id);
    writeCart({ items: newItems, total: calculateTotal(newItems) });
  };

  // Atualizar quantidade de um item
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }

    const current = readCart();
    const newItems = current.items.map(item =>
      item.id === id ? { ...item, quantity } : item
    );
    writeCart({ items: newItems, total: calculateTotal(newItems) });
  };

  // Limpar carrinho
  const clearCart = () => {
    writeCart(EMPTY_CART);
  };

  // Obter quantidade total de itens
  const getTotalQuantity = (): number => {
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalQuantity,
    isLoaded
  };
}
