import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartLine = {
  variant_id: number;
  product_id: number;
  organization_id: number;
  title: string;
  attributes: Record<string, string>;
  price_uzs: number | null;
  quantity: number;
};

type Ctx = {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "mz_cart";

function load(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* хранилище недоступно: корзина живёт до перезагрузки */
    }
  }, [lines]);

  const add = (line: CartLine) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variant_id === line.variant_id);
      if (!existing) return [...prev, line];
      return prev.map((l) =>
        l.variant_id === line.variant_id ? { ...l, quantity: l.quantity + line.quantity } : l,
      );
    });
  const setQuantity = (variantId: number, quantity: number) =>
    setLines((prev) =>
      prev.map((l) => (l.variant_id === variantId ? { ...l, quantity: Math.max(1, quantity) } : l)),
    );
  const remove = (variantId: number) =>
    setLines((prev) => prev.filter((l) => l.variant_id !== variantId));
  const clear = () => setLines([]);

  return (
    <CartContext.Provider value={{ lines, add, setQuantity, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("CartProvider missing");
  return ctx;
}
