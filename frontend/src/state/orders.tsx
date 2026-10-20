import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { api, ApiError } from '../api/client';
import { createDemoOrder, initialOrders, remainingApprovals, transitionDemoOrder, type DemoOrder, type OrderResult, type OrderStatus } from '../domain/orders';
import type { CartItem } from '../domain/cart';
import type { CheckoutDraft } from '../domain/checkout';
import { usePrescriptions } from './prescriptions';
import { prescriptionGrants, type Approval } from '../domain/prescriptions';
import { useProfile } from './profile';

type OrdersContext = {
  orders: DemoOrder[];
  approvals: Approval[];
  loading: boolean;
  syncIssue: string;
  placeOrder: (items: CartItem[], draft: CheckoutDraft, submissionKey: string) => Promise<OrderResult>;
  updateOrder: (id: string, status: OrderStatus, note?: string) => Promise<OrderResult>;
};
type RemoteOrder = { external_id: string; data: DemoOrder };
const Context = createContext<OrdersContext | null>(null);
const orderRows = (value: { results?: RemoteOrder[] } | RemoteOrder[]) => Array.isArray(value) ? value : value.results ?? [];

export function OrdersProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  const { records } = usePrescriptions();
  const grants = prescriptionGrants(records);
  const [state, setState] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [syncIssue, setSyncIssue] = useState('');
  const latest = useRef(state);
  function commit(result: OrderResult) {
    if (result.ok) { latest.current = result.state; setState(result.state); }
    return result;
  }
  useEffect(() => {
    let active = true;
    if (!profile) { latest.current = initialOrders(); setState(latest.current); setLoading(false); setSyncIssue(''); return () => { active = false; }; }
    setLoading(true);
    api.listOrders<RemoteOrder>().then(response => {
      if (!active) return;
      const orders = orderRows(response).map(row => row.data).filter(Boolean);
      latest.current = { orders, nextNumber: 1 };
      setState(latest.current);
      setSyncIssue('');
    }).catch(() => { if (active) setSyncIssue('Saved orders could not be loaded. Check your connection.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile?.email]);

  const placeOrder: OrdersContext['placeOrder'] = async (items, draft, key) => {
    const result = createDemoOrder(latest.current, items, draft, key, Date.now(), grants);
    if (!result.ok || !profile) return commit(result);
    try { await api.saveOrder(result.order.id, result.order); setSyncIssue(''); return commit(result); }
    catch (error) { return { ok: false, state: latest.current, issue: error instanceof ApiError ? error.message : 'Could not save this order to your account. Please try again.' }; }
  };
  const updateOrder: OrdersContext['updateOrder'] = async (id, status, note = '') => {
    const result = transitionDemoOrder(latest.current, id, status, note, Date.now());
    if (!result.ok || !profile) return commit(result);
    try { await api.saveOrder(result.order.id, result.order); setSyncIssue(''); return commit(result); }
    catch (error) { return { ok: false, state: latest.current, issue: error instanceof ApiError ? error.message : 'Could not save the order update. Please try again.' }; }
  };
  return <Context.Provider value={{ orders: state.orders, approvals: remainingApprovals(grants, state.orders), loading, syncIssue, placeOrder, updateOrder }}>{children}</Context.Provider>;
}
export function useOrders() {
  const value = useContext(Context);
  if (!value) throw new Error('OrdersProvider missing');
  return value;
}
