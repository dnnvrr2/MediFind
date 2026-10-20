import { createContext, useContext, useState, type Dispatch, type SetStateAction, type PropsWithChildren } from 'react';
import { initialCheckout, type CheckoutDraft } from '../domain/checkout';

const Context = createContext<{ draft: CheckoutDraft; setDraft: Dispatch<SetStateAction<CheckoutDraft>> } | null>(null);

export function CheckoutProvider({ children }: PropsWithChildren) {
  // Session-only draft: navigation keeps it; refreshing/restarting clears it.
  const [draft, setDraft] = useState(initialCheckout);
  return <Context.Provider value={{ draft, setDraft }}>{children}</Context.Provider>;
}

export function useCheckout() {
  const value = useContext(Context);
  if (!value) throw new Error('CheckoutProvider missing');
  return value;
}
