import './catalog-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileIssue, submitPrescription, replacePrescription, prescriptionGrants } from '../src/domain/prescriptions.ts';
import { addItem, changeQuantity } from '../src/domain/cart.ts';
import { quoteCheckout } from '../src/domain/checkout.ts';
import { prepareOrder, initialOrders, remainingApprovals, requestOrderCancellation } from '../src/domain/orders.ts';

const file = () => ({ uri: 'file:///demo.png', name: 'demo.png', mimeType: 'image/png', size: 2048 });
const rx = () => ({ id: 'RX-0001', revision: 1, createdAt: 1, updatedAt: 1, file: file(), status: 'draft', requested: [{ medicineId: 'tramadol-paracetamol', quantity: 3 }, { medicineId: 'cetirizine', quantity: 2 }], pharmacyId: 'healthplus', approved: [], note: '' });
const pending = () => submitPrescription(rx(), 2).record;
const approved = () => ({ ...pending(), managed: true, status: 'approved', approved: rx().requested, updatedAt: 3 });
const contact = { method: 'pickup', name: 'Demo Customer', phone: '09170000000', address: null };
const cart = () => [{ medicineId: 'tramadol-paracetamol', pharmacyId: 'healthplus', quantity: 2, prescriptionId: 'RX-0001', revision: 1 }];

test('local files enforce supported formats, known nonzero size, and 10 MB limit', () => {
  assert.equal(fileIssue(file()), '');
  for (const change of [{ size: 0 }, { size: NaN }, { size: 10485761 }, { mimeType: 'image/svg+xml' }, { uri: '' }]) assert.ok(fileIssue({ ...file(), ...change }));
});
test('prescriptions can be sent for review only to an open pharmacy', () => {
  const result = submitPrescription({ ...rx(), requested: [] }, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.record.approved, []);
  for (const changed of [{ file: { ...file(), size: 0 } }, { requested: [{ medicineId: 'cetirizine', quantity: 1.5 }] }, { requested: [rx().requested[0], rx().requested[0]] }, { pharmacyId: 'unknown' }, { pharmacyId: 'mercury' }]) {
    assert.equal(submitPrescription({ ...rx(), ...changed }, 2).ok, false);
  }
  assert.equal(submitPrescription(pending(), 3).ok, false);
});

test('only pharmacist-approved records provide ordering grants', () => {
  assert.deepEqual(prescriptionGrants([{ ...approved(), managed: false }]), []);
  assert.equal(prescriptionGrants([approved()]).length, 2);
  for (const status of ['pending', 'rejected', 'needs_clearer_photo']) {
    assert.deepEqual(prescriptionGrants([{ ...approved(), status }]), []);
  }
});
test('replacing an approved file invalidates old grants and requires resubmission', () => {
  const old = approved(); const replacement = replacePrescription(old, { ...file(), uri: 'file:///new.png' }, 4);
  assert.equal(replacement.ok, true); assert.equal(replacement.record.revision, 2); assert.equal(replacement.record.status, 'draft'); assert.deepEqual(replacement.record.approved, []);
  assert.equal(quoteCheckout(cart(), 'pickup', prescriptionGrants([replacement.record])).ok, false);
  assert.equal(submitPrescription(replacement.record, 5).ok, true);
  assert.equal(replacePrescription(pending(), file(), 4).ok, false);
  assert.equal(old.status, 'approved'); assert.equal(old.revision, 1);
});
test('cart and checkout bind approval to prescription, version, medicine, pharmacy and total quantity', () => {
  const grants = prescriptionGrants([approved()]);
  const added = addItem([], 'tramadol-paracetamol', 'healthplus', 2, false, grants, 'RX-0001', 1);
  assert.equal(added.kind, 'added'); assert.equal(quoteCheckout(added.items, 'pickup', grants).total, 48);
  assert.equal(addItem(added.items, 'tramadol-paracetamol', 'healthplus', 2, false, grants, 'RX-0001', 1).kind, 'prescription');
  assert.equal(changeQuantity(added.items, 'tramadol-paracetamol', 4, grants)[0].quantity, 2);
  assert.equal(changeQuantity(added.items, 'tramadol-paracetamol', 3, grants)[0].quantity, 3);
  for (const change of [{ prescriptionId: 'other' }, { revision: 2 }, { pharmacyId: 'rika' }, { quantity: 4 }, { prescriptionId: undefined }]) assert.equal(quoteCheckout([{ ...cart()[0], ...change }], 'pickup', grants).ok, false);
  assert.equal(quoteCheckout(cart(), 'pickup', []).ok, false);
});
test('approved request OTC items also retain review quantity restrictions', () => {
  const grants = prescriptionGrants([approved()]);
  const item = { medicineId: 'cetirizine', pharmacyId: 'healthplus', quantity: 3, prescriptionId: 'RX-0001', revision: 1 };
  assert.equal(quoteCheckout([item], 'pickup', grants).ok, false);
  assert.equal(addItem([{ ...item, quantity: 1 }], 'cetirizine', 'healthplus', 1).kind, 'prescription');
});
test('orders consume approval units once, revalidate at submission, and retain independent review evidence', () => {
  const grants = prescriptionGrants([approved()]);
  const first = prepareOrder(initialOrders(), cart(), contact, 'one', 4, grants);
  assert.equal(first.ok, true); assert.equal(first.order.total, 48); assert.equal(first.order.lines[0].approval.prescriptionId, 'RX-0001');
  assert.equal(remainingApprovals(grants, first.state.orders)[0].quantity, 1);
  assert.equal(prepareOrder(first.state, cart(), contact, 'two', 5, grants).ok, false);
  assert.equal(prepareOrder(first.state, [], contact, 'one', 5, grants).order.id, first.order.id);
  const cancelled = requestOrderCancellation(first.order);
  assert.equal(remainingApprovals(grants, [cancelled])[0].quantity, 1);
  assert.equal(prepareOrder(initialOrders(), cart(), contact, 'stale', 5, []).ok, false);
  grants[0].quantity = 99;
  assert.equal(first.order.lines[0].approval.quantity, 3);
});
