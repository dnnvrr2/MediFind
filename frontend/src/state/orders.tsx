import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { api, ApiError, sessionGeneration } from '../api/client';
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
  refreshOrders: () => Promise<void>;
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
  const alive = useRef(true);
  const generation = useRef(sessionGeneration()).current;
  const mutations = useRef(0);
  const fetching = useRef(false);
  const valid = () => alive.current && generation === sessionGeneration();
  function commitOrder(result: Extract<OrderResult, { ok: true }>, order: DemoOrder) {
    const state = { orders: [order, ...latest.current.orders.filter(row => row.id !== order.id)], nextNumber: Math.max(latest.current.nextNumber, result.state.nextNumber) };
    latest.current = state; setState(state); setSyncIssue(''); mutations.current++;
    return { ...result, order, state };
  }
  const refreshOrders = useCallback(async () => {
    if (!profile || fetching.current || !valid()) return;
    fetching.current = true;
    const before = mutations.current;
    try {
      const response = await api.listOrders<RemoteOrder>();
      if (!valid() || before !== mutations.current) return;
      const orders = orderRows(response).map(row => row.data).filter(Boolean);
      latest.current = { orders, nextNumber: Math.max(latest.current.nextNumber, orders.length + 1) };
      setState(latest.current); setSyncIssue('');
    } catch { if (valid()) setSyncIssue('Saved orders could not be refreshed. Check your connection.'); }
    finally { fetching.current = false; if (valid()) setLoading(false); }
  }, [profile?.id, profile?.email, generation]);
  useEffect(() => {
    alive.current = true;
    if (profile) { setLoading(true); void refreshOrders(); }
    const timer = profile ? setInterval(() => void refreshOrders(), 20000) : undefined;
    return () => { alive.current = false; if (timer) clearInterval(timer); };
  }, [refreshOrders]);

  const placeOrder: OrdersContext['placeOrder'] = async (items, draft, key) => {
    if (!profile || !valid()) return { ok: false, state: latest.current, issue: 'Sign in before placing an order.' };
    const result = createDemoOrder(latest.current, items, draft, key, Date.now(), grants);
    if (!result.ok) return result;
    mutations.current++;
    try { const saved = await api.saveOrder(result.order.id, result.order); if (!valid()) return { ok: false, state: latest.current, issue: 'The account changed. Reopen your orders.' }; return commitOrder(result, saved.data); }
    catch (error) { return { ok: false, state: latest.current, issue: error instanceof ApiError ? error.message : 'Could not save this order. Retry with the same checkout.' }; }
  };
  const updateOrder: OrdersContext['updateOrder'] = async (id, status, note = '') => {
    if (!profile || !valid()) return { ok: false, state: latest.current, issue: 'Sign in to update your order.' };
    const original = latest.current.orders.find(order => order.id === id);
    if (original?.managed && status !== 'cancelled') return { ok: false, state: latest.current, issue: 'Only the pharmacy or assigned rider can update this order.' };
    const result = transitionDemoOrder(latest.current, id, status, note, Date.now());
    if (!result.ok) return result;
    mutations.current++;
    try { const saved = await api.saveOrder(result.order.id, result.order); if (!valid()) return { ok: false, state: latest.current, issue: 'The account changed. Reopen your orders.' }; return commitOrder(result, saved.data); }
    catch (error) { return { ok: false, state: latest.current, issue: error instanceof ApiError ? error.message : 'Could not save the order update. Please try again.' }; }
  };
  return <Context.Provider value={{ orders: state.orders, approvals: remainingApprovals(grants, state.orders), loading, syncIssue, placeOrder, updateOrder, refreshOrders }}>{children}</Context.Provider>;
}
export function useOrders() {
  const value = useContext(Context);
  if (!value) throw new Error('OrdersProvider missing');
  return value;
}
