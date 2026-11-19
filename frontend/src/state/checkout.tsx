import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { initialCheckout, type CheckoutDraft } from '../domain/checkout';
import { useProfile } from './profile';

const Context = createContext<{ draft: CheckoutDraft; updateDraft: (changes: Partial<CheckoutDraft>) => void } | null>(null);

export function CheckoutProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  // Keep edits for this checkout session, including fields the recipient clears.
  const [edits, setEdits] = useState<Partial<CheckoutDraft>>({});
  const draft = {
    ...initialCheckout(),
    name: profile?.fullName ?? '',
    phone: profile?.phone ?? '',
    ...edits,
  };
  function updateDraft(changes: Partial<CheckoutDraft>) {
    setEdits(previous => ({ ...previous, ...changes }));
  }
  return <Context.Provider value={{ draft, updateDraft }}>{children}</Context.Provider>;
}

export function useCheckout() {
  const value = useContext(Context);
  if (!value) throw new Error('CheckoutProvider missing');
  return value;
}
