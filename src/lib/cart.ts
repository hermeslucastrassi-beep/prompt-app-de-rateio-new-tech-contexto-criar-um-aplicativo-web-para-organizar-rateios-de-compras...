import { useCallback, useEffect, useState } from "react";

export const CART_KEY = "newtech.cart";

export type CartItem = { productId: string; name: string; quantity: number };

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i?.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("newtech-cart"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener("newtech-cart", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("newtech-cart", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addItem = useCallback((item: CartItem) => {
    const next = read();
    const found = next.find((i) => i.productId === item.productId);
    if (found) found.quantity = Math.min(50, found.quantity + item.quantity);
    else next.push({ ...item, quantity: Math.min(50, Math.max(1, item.quantity)) });
    write(next);
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = read()
      .map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(50, Math.max(1, Math.floor(quantity) || 1)) }
          : i,
      );
    write(next);
  }, []);

  const removeItem = useCallback((productId: string) => {
    write(read().filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, count, addItem, setQuantity, removeItem, clear };
}
