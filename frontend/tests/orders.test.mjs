import './catalog-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareOrder, initialOrders, requestOrderCancellation, isCurrentOrder, timelineSteps, orderQuote } from '../src/domain/orders.ts';
import { offers } from '../src/data/catalog.ts';
const cart = () => [{ medicineId: 'paracetamol-tablet', pharmacyId: 'healthplus', quantity: 6 }];
const draft = (method = 'delivery') => ({ method, name: 'Preview Customer', phone: '09170000000', address: { street: '456 Sample Street', barangay: 'Sample Barangay', city: 'Cagayan de Oro City', province: 'Misamis Oriental', postalCode: '9000' } });
const create = (method = 'delivery') => prepareOrder(initialOrders(), cart(), draft(method), 'attempt-1', 1000);

test('order snapshots carry checkout values and do not alias the cart, address or catalog', () => {
  const items = cart(); const contact = draft(); const result = prepareOrder(initialOrders(), items, contact, 'one', 1000);
  assert.equal(result.ok, true); assert.equal(result.order.total, 80); assert.equal(result.order.subtotal, 30); assert.equal(result.order.deliveryFee, 50);
  assert.equal(result.order.status, 'awaiting_confirmation'); assert.equal(result.order.pharmacy.id, 'healthplus');
  items[0].quantity = 20; contact.address.street = 'Changed'; contact.name = 'Changed';
  assert.equal(result.order.lines[0].quantity, 6); assert.equal(result.order.address.street, '456 Sample Street'); assert.equal(result.order.recipient.name, 'Preview Customer');
  const original = offers[0].price;
  try { offers[0].price = 999; assert.equal(orderQuote(result.order).total, 80); assert.equal(orderQuote(result.order).lines[0].unitPrice, 5); }
  finally { offers[0].price = original; }
});

test('a repeated submission key returns the same order even after cart clearing', () => {
  const first = create(); const repeated = prepareOrder(first.state, [], draft(), 'attempt-1', 2000);
  assert.equal(repeated.ok, true); assert.equal(repeated.created, false); assert.equal(repeated.order.id, first.order.id); assert.equal(repeated.state.orders.length, 1);
  const second = prepareOrder(first.state, cart(), draft(), 'attempt-2', 2000);
  assert.equal(second.order.id, 'ORDER-' + second.order.submissionKey); assert.equal(second.state.orders.length, 2);
});

test('invalid submissions do not create an order or consume an ID', () => {
  for (const [items, contact, key] of [[[], draft(), 'x'], [cart(), { ...draft(), name: '' }, 'x'], [cart(), { ...draft(), phone: '123' }, 'x'], [cart(), { ...draft(), address: null }, 'x'], [cart(), draft(), '']]) {
    const state = initialOrders(); const result = prepareOrder(state, items, contact, key, 1000);
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(result.state.nextNumber, 1);
  }
});

test('pickup and pharmacy delivery have separate timelines', () => {
  const pickup = create('pickup').order;
  assert.equal(pickup.total, 30);
  assert.equal(pickup.address, null);
  assert.equal(timelineSteps('pickup').some(step => step.status === 'out_for_delivery'), false);
  assert.ok(timelineSteps('delivery', true).some(step => step.status === 'rider_collected'));
});

test('customers can request cancellation only before acceptance', () => {
  const { order } = create();
  const cancelled = requestOrderCancellation(order);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(order.status, 'awaiting_confirmation');
  assert.equal(isCurrentOrder(cancelled), false);
  for (const status of ['confirmed', 'preparing', 'delivered', 'rejected']) {
    assert.equal(requestOrderCancellation({ ...order, status }), null);
  }
});
