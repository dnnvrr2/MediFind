import { quoteCheckout, validateCheckout, type CheckoutDraft, type CheckoutQuote, type DeliveryAddress, type Fulfillment, type QuoteLine } from './checkout.ts';
import type { CartItem } from './cart.ts';
import type { Approval } from './prescriptions.ts';
import type { Pharmacy } from '../data/catalog.ts';

export type OrderStatus = 'awaiting_confirmation' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'collected' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'rejected' | 'delivery_failed';
export type OrderEvent = { status: OrderStatus; at: number; note: string };
export type DemoOrder = {
  id: string; submissionKey: string; createdAt: number; updatedAt: number; status: OrderStatus;
  method: Fulfillment; pharmacy: Pharmacy; lines: QuoteLine[];
  recipient: { name: string; phone: string }; address: DeliveryAddress | null;
  subtotal: number; deliveryFee: number; total: number; payment: string; events: OrderEvent[];
};
export type OrdersState = { orders: DemoOrder[]; nextNumber: number };
export type OrderResult = { ok: true; state: OrdersState; order: DemoOrder; created: boolean } | { ok: false; state: OrdersState; issue: string };
export const initialOrders = (): OrdersState => ({ orders: [], nextNumber: 1 });

export const statusInfo: Record<OrderStatus, { label: string; description: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  awaiting_confirmation: { label: 'Awaiting confirmation', description: 'Waiting for simulated pharmacy confirmation.', tone: 'warning' },
  confirmed: { label: 'Confirmed', description: 'The pharmacy confirmation has been simulated.', tone: 'neutral' },
  preparing: { label: 'Preparing', description: 'Preparation is being simulated.', tone: 'neutral' },
  ready_for_pickup: { label: 'Ready for pickup', description: 'This demo order is ready for collection at the selected pharmacy.', tone: 'success' },
  collected: { label: 'Collected', description: 'Collection has been simulated. This demo order is complete.', tone: 'success' },
  out_for_delivery: { label: 'Out for delivery', description: 'Delivery progress is simulated. No rider has been dispatched.', tone: 'neutral' },
  delivered: { label: 'Delivered', description: 'Delivery has been simulated. This demo order is complete.', tone: 'success' },
  cancelled: { label: 'Cancelled', description: 'This demo order was cancelled. No payment was collected.', tone: 'neutral' },
  rejected: { label: 'Pharmacy rejected', description: 'A pharmacy rejection has been simulated. Nothing was charged.', tone: 'danger' },
  delivery_failed: { label: 'Delivery failed', description: 'A delivery issue has been simulated. No real delivery was attempted.', tone: 'danger' },
};

export function isCurrentOrder(order: DemoOrder): boolean {
  return !(['collected', 'delivered', 'cancelled', 'rejected', 'delivery_failed'] as OrderStatus[]).includes(order.status);
}

export function timelineSteps(method: Fulfillment): { status: OrderStatus; label: string }[] {
  return [
    { status: 'awaiting_confirmation', label: 'Order submitted' },
    { status: 'confirmed', label: 'Pharmacy confirmed' },
    { status: 'preparing', label: 'Preparing your items' },
    ...(method === 'pickup' ? [
      { status: 'ready_for_pickup' as const, label: 'Ready for pickup' },
      { status: 'collected' as const, label: 'Collected' },
    ] : [
      { status: 'out_for_delivery' as const, label: 'Out for delivery' },
      { status: 'delivered' as const, label: 'Delivered' },
    ]),
  ];
}

export function allowedTransitions(order: DemoOrder): OrderStatus[] {
  switch (order.status) {
    case 'awaiting_confirmation': return ['confirmed', 'rejected', 'cancelled'];
    case 'confirmed': return ['preparing'];
    case 'preparing': return [order.method === 'pickup' ? 'ready_for_pickup' : 'out_for_delivery'];
    case 'ready_for_pickup': return ['collected'];
    case 'out_for_delivery': return ['delivered', 'delivery_failed'];
    default: return [];
  }
}

// Approval units remain consumed even after cancellation; a real pharmacy must authorize reuse.
export function remainingApprovals(grants: Approval[], orders: DemoOrder[]): Approval[] {
  return grants.map(g => ({ ...g, quantity: Math.max(0, g.quantity - orders.flatMap(o => o.lines).filter(l => l.approval?.prescriptionId === g.prescriptionId && l.approval?.revision === g.revision && l.medicine.id === g.medicineId && l.approval?.pharmacyId === g.pharmacyId).reduce((sum, l) => sum + l.quantity, 0)) }));
}

export function createDemoOrder(state: OrdersState, items: CartItem[], draft: CheckoutDraft, submissionKey: string, at: number, grants: Approval[] = []): OrderResult {
  const existing = state.orders.find(order => order.submissionKey === submissionKey);
  if (existing) return { ok: true, state, order: existing, created: false };
  if (!submissionKey.trim() || !Number.isFinite(at)) return { ok: false, state, issue: 'Could not create this demo order. Please try again.' };
  const errors = validateCheckout(draft);
  if (Object.keys(errors).length) return { ok: false, state, issue: 'Check the recipient and delivery address before submitting.' };
  const quote = quoteCheckout(items, draft.method, remainingApprovals(grants, state.orders));
  if (!quote.ok) return { ok: false, state, issue: quote.issue };
  const address = draft.method === 'delivery' && draft.address ? Object.fromEntries(Object.entries(draft.address).map(([key, value]) => [key, value.trim()])) as DeliveryAddress : null;
  const order: DemoOrder = {
    id: `DEMO-${String(state.nextNumber).padStart(6, '0')}`, submissionKey, createdAt: at, updatedAt: at,
    status: 'awaiting_confirmation', method: quote.method, pharmacy: { ...quote.pharmacy },
    lines: quote.lines.map(line => ({ ...line, medicine: { ...line.medicine }, ...(line.approval ? { approval: { ...line.approval } } : {}) })),
    recipient: { name: draft.name.trim(), phone: draft.phone.trim() }, address,
    subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, total: quote.total, payment: quote.payment,
    events: [{ status: 'awaiting_confirmation', at, note: 'Demo order created locally. Nothing was sent to a pharmacy.' }],
  };
  return { ok: true, order, created: true, state: { orders: [order, ...state.orders], nextNumber: state.nextNumber + 1 } };
}

export function transitionDemoOrder(state: OrdersState, id: string, next: OrderStatus, note: string, at: number): OrderResult {
  const order = state.orders.find(order => order.id === id);
  if (!order) return { ok: false, state, issue: 'This demo order is no longer in this session.' };
  if (!allowedTransitions(order).includes(next)) return { ok: false, state, issue: 'This action is no longer available for the order’s current status.' };
  if (!Number.isFinite(at)) return { ok: false, state, issue: 'The status could not be updated. Please try again.' };
  if ((next === 'rejected' || next === 'delivery_failed') && !note.trim()) return { ok: false, state, issue: 'Enter a reason for this simulated outcome.' };
  const timestamp = Math.max(at, order.updatedAt);
  const updated: DemoOrder = { ...order, status: next, updatedAt: timestamp, events: [...order.events, {
    status: next, at: timestamp, note: note.trim() || (next === 'cancelled' ? 'Cancelled by the customer in the preview.' : statusInfo[next].description),
  }] };
  return { ok: true, order: updated, created: false, state: { ...state, orders: state.orders.map(item => item.id === id ? updated : item) } };
}

// Render from the stored snapshot, never from today's catalog prices or cart.
export function orderQuote(order: DemoOrder): Extract<CheckoutQuote, { ok: true }> {
  return { ok: true, pharmacy: order.pharmacy, lines: order.lines, subtotal: order.subtotal, deliveryFee: order.deliveryFee, total: order.total, payment: order.payment, method: order.method };
}

export function orderTime(at: number): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(at)) + ' PHT';
}
