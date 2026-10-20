import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoOrder, initialOrders, transitionDemoOrder, isCurrentOrder, timelineSteps, orderQuote } from '../src/domain/orders.ts';
import { offers } from '../src/data/catalog.ts';
const cart = () => [{ medicineId: 'paracetamol-tablet', pharmacyId: 'healthplus', quantity: 6 }];
const draft = (method = 'delivery') => ({ method, name: 'Preview Customer', phone: '09170000000', address: { street: '456 Sample Street', barangay: 'Sample Barangay', city: 'Cagayan de Oro City', province: 'Misamis Oriental', postalCode: '9000' } });
const create = (method = 'delivery') => createDemoOrder(initialOrders(), cart(), draft(method), 'attempt-1', 1000);

test('order snapshots carry checkout values and do not alias the cart, address or catalog', () => {
  const items = cart(); const contact = draft(); const result = createDemoOrder(initialOrders(), items, contact, 'one', 1000);
  assert.equal(result.ok, true); assert.equal(result.order.total, 80); assert.equal(result.order.subtotal, 30); assert.equal(result.order.deliveryFee, 50);
  assert.equal(result.order.status, 'awaiting_confirmation'); assert.equal(result.order.pharmacy.id, 'healthplus');
  items[0].quantity = 20; contact.address.street = 'Changed'; contact.name = 'Changed';
  assert.equal(result.order.lines[0].quantity, 6); assert.equal(result.order.address.street, '456 Sample Street'); assert.equal(result.order.recipient.name, 'Preview Customer');
  const original = offers[0].price;
  try { offers[0].price = 999; assert.equal(orderQuote(result.order).total, 80); assert.equal(orderQuote(result.order).lines[0].unitPrice, 5); }
  finally { offers[0].price = original; }
});

test('a repeated submission key returns the same order even after cart clearing', () => {
  const first = create(); const repeated = createDemoOrder(first.state, [], draft(), 'attempt-1', 2000);
  assert.equal(repeated.ok, true); assert.equal(repeated.created, false); assert.equal(repeated.order.id, first.order.id); assert.equal(repeated.state.orders.length, 1);
  const second = createDemoOrder(first.state, cart(), draft(), 'attempt-2', 2000);
  assert.equal(second.order.id, 'DEMO-000002'); assert.equal(second.state.orders.length, 2);
});

test('invalid submissions do not create an order or consume an ID', () => {
  for (const [items, contact, key] of [[[], draft(), 'x'], [cart(), { ...draft(), name: '' }, 'x'], [cart(), { ...draft(), phone: '123' }, 'x'], [cart(), { ...draft(), address: null }, 'x'], [cart(), draft(), '']]) {
    const state = initialOrders(); const result = createDemoOrder(state, items, contact, key, 1000);
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(result.state.nextNumber, 1);
  }
});

test('delivery progresses in order and completed orders are previous', () => {
  let result = create();
  for (const next of ['confirmed', 'preparing', 'out_for_delivery', 'delivered']) { result = transitionDemoOrder(result.state, result.order.id, next, '', result.order.updatedAt + 1000); assert.equal(result.ok, true); }
  assert.equal(isCurrentOrder(result.order), false); assert.equal(result.order.events.length, 5);
  assert.equal(transitionDemoOrder(result.state, result.order.id, 'confirmed', '', 9999).ok, false);
});

test('pickup has its own timeline, zero fee, and cannot enter delivery states', () => {
  let result = create('pickup'); assert.equal(result.order.total, 30); assert.equal(result.order.payment, 'Pay at Pharmacy'); assert.equal(result.order.address, null);
  assert.equal(timelineSteps('pickup').some(s => s.status === 'out_for_delivery'), false);
  assert.equal(timelineSteps('delivery').some(s => s.status === 'ready_for_pickup'), false);
  for (const next of ['confirmed', 'preparing', 'ready_for_pickup', 'collected']) { result = transitionDemoOrder(result.state, result.order.id, next, '', result.order.updatedAt + 1000); assert.equal(result.ok, true); }
  assert.equal(isCurrentOrder(result.order), false); assert.equal(transitionDemoOrder(result.state, result.order.id, 'out_for_delivery', '', 9999).ok, false);
});

test('cancellation is allowed only before confirmation and records its outcome', () => {
  const start = create(); const cancelled = transitionDemoOrder(start.state, start.order.id, 'cancelled', 'Changed my mind', 2000);
  assert.equal(cancelled.ok, true); assert.equal(isCurrentOrder(cancelled.order), false); assert.equal(cancelled.order.events.at(-1).note, 'Changed my mind');
  const confirmed = transitionDemoOrder(start.state, start.order.id, 'confirmed', '', 2000);
  assert.equal(transitionDemoOrder(confirmed.state, start.order.id, 'cancelled', '', 3000).ok, false);
  assert.equal(transitionDemoOrder(cancelled.state, start.order.id, 'confirmed', '', 3000).ok, false);
});

test('rejection and failed delivery require reasons and close the right orders', () => {
  let result = create();
  assert.equal(transitionDemoOrder(result.state, result.order.id, 'rejected', ' ', 2000).ok, false);
  const rejected = transitionDemoOrder(result.state, result.order.id, 'rejected', 'Sample stock mismatch', 2000);
  assert.equal(rejected.ok, true); assert.equal(isCurrentOrder(rejected.order), false);
  assert.equal(transitionDemoOrder(result.state, result.order.id, 'delivery_failed', 'Address issue', 2000).ok, false);
  for (const next of ['confirmed', 'preparing', 'out_for_delivery']) result = transitionDemoOrder(result.state, result.order.id, next, '', result.order.updatedAt + 1000);
  assert.equal(transitionDemoOrder(result.state, result.order.id, 'delivery_failed', '', 5000).ok, false);
  result = transitionDemoOrder(result.state, result.order.id, 'delivery_failed', 'Sample recipient unavailable', 5000);
  assert.equal(result.ok, true); assert.equal(isCurrentOrder(result.order), false); assert.equal(result.order.events.at(-1).note, 'Sample recipient unavailable');
});

test('invalid transitions leave state unchanged and event times never go backwards', () => {
  const start = create(); const skipped = transitionDemoOrder(start.state, start.order.id, 'delivered', '', 2000);
  assert.equal(skipped.ok, false); assert.equal(skipped.state, start.state); assert.equal(start.order.events.length, 1);
  const confirmed = transitionDemoOrder(start.state, start.order.id, 'confirmed', '', 100);
  assert.equal(confirmed.order.updatedAt, 1000); assert.equal(confirmed.order.events.at(-1).at, 1000);
  assert.equal(transitionDemoOrder(start.state, 'missing', 'cancelled', '', 2000).ok, false);
});
