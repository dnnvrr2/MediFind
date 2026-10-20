import React, { createContext, useContext, useState } from 'react';
import type { CartItem } from '../domain/cart';
const Context = createContext<{ items: CartItem[]; setItems: React.Dispatch<React.SetStateAction<CartItem[]>> } | null>(null);
export function CartProvider({ children }: React.PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);
  return <Context.Provider value={{ items, setItems }}>{children}</Context.Provider>;
}
export function useCart() { const value = useContext(Context); if (!value) throw new Error('CartProvider missing'); return value; }
