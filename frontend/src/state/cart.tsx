import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren, type SetStateAction } from 'react';
import { Platform } from 'react-native';
import type { CartItem } from '../domain/cart';
import { readSavedCart, saveCart, savedCartKey } from './cart-storage';

type CartState = { items: CartItem[]; storageIssue: string };
const Context = createContext<(CartState & { setItems: (update: SetStateAction<CartItem[]>) => void }) | null>(null);

function loadCart(key?: string): CartState {
  try {
    return { items: key ? readSavedCart(key) : [], storageIssue: '' };
  } catch {
    return { items: [], storageIssue: 'Could not load your saved cart.' };
  }
}

export function CartProvider({ children, accountId }: PropsWithChildren<{ accountId?: string }>) {
  const key = accountId ? savedCartKey(accountId) : undefined;
  const [state, setState] = useState(() => loadCart(key));
  const latest = useRef(state);
  function commit(next: CartState) {
    latest.current = next;
    setState(next);
  }

  useEffect(() => {
    if (!key || Platform.OS !== 'web' || typeof window === 'undefined') return;
    function sync(event: StorageEvent) {
      if (event.key !== key || latest.current.storageIssue) return;
      const next = loadCart(key);
      if (!next.storageIssue) commit(next);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  function setItems(update: SetStateAction<CartItem[]>) {
    const items = typeof update === 'function' ? update(latest.current.items) : update;
    let storageIssue = '';
    try {
      if (key) saveCart(key, items);
    } catch {
      storageIssue = 'Could not save your cart on this device.';
    }
    commit({ items, storageIssue });
  }

  return <Context.Provider value={{ ...state, setItems }}>{children}</Context.Provider>;
}

export function useCart() {
  const value = useContext(Context);
  if (!value) throw new Error('CartProvider missing');
  return value;
}
