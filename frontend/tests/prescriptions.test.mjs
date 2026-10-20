import test from 'node:test';
import assert from 'node:assert/strict';
import { fileIssue, submitPrescription, reviewPrescription, replacePrescription, prescriptionGrants, pharmacyEstimate } from '../src/domain/prescriptions.ts';
import { addItem, changeQuantity } from '../src/domain/cart.ts';
import { quoteCheckout } from '../src/domain/checkout.ts';
import { createDemoOrder, initialOrders, remainingApprovals, transitionDemoOrder } from '../src/domain/orders.ts';

const file = () => ({ uri: 'file:///demo.png', name: 'demo.png', mimeType: 'image/png', size: 2048 });
const rx = () => ({ id: 'RX-0001', revision: 1, createdAt: 1, updatedAt: 1, file: file(), status: 'draft', requested: [{ medicineId: 'tramadol-paracetamol', quantity: 3 }, { medicineId: 'cetirizine', quantity: 2 }], pharmacyId: 'healthplus', approved: [], note: '' });
const pending = () => submitPrescription(rx(), 2).record;
const approved = () => reviewPrescription(pending(), 'approved', rx().requested, '', 3).record;
const contact = { method: 'pickup', name: 'Demo Customer', phone: '09170000000', address: null };
const cart = () => [{ medicineId: 'tramadol-paracetamol', pharmacyId: 'healthplus', quantity: 2, prescriptionId: 'RX-0001', revision: 1 }];

test('local files enforce supported formats, known nonzero size, and 10 MB limit', () => {
  assert.equal(fileIssue(file()), '');
  for (const change of [{ size: 0 }, { size: NaN }, { size: 10485761 }, { mimeType: 'image/svg+xml' }, { uri: '' }]) assert.ok(fileIssue({ ...file(), ...change }));
});
test('pharmacy estimate exposes partial per-item quantities and available-item totals', () => {
  const estimate = pharmacyEstimate(rx().requested, 'rika');
  assert.equal(estimate.all, false); assert.equal(estimate.any, true); assert.equal(estimate.total, 14);
  assert.equal(estimate.rows[0].available, 0); assert.equal(estimate.rows[0].unitPrice, null); assert.equal(estimate.rows[1].available, 2);
});
test('submission validates file, request, quantities, stock and one selected pharmacy', () => {
  assert.equal(submitPrescription(rx(), 2).ok, true);
  for (const changed of [{ requested: [] }, { file: { ...file(), size: 0 } }, { requested: [{ medicineId: 'cetirizine', quantity: 1.5 }] }, { requested: [rx().requested[0], rx().requested[0]] }, { pharmacyId: 'unknown' }, { pharmacyId: 'mercury' }]) assert.equal(submitPrescription({ ...rx(), ...changed }, 2).ok, false);
  assert.equal(submitPrescription(pending(), 3).ok, false);
});
test('review can only accept requested quantities in sample stock and requires explicit partial reasons', () => {
  assert.equal(reviewPrescription(rx(), 'approved', rx().requested, '', 3).ok, false);
  assert.equal(reviewPrescription(pending(), 'approved', [{ medicineId: 'tramadol-paracetamol', quantity: 4 }], '', 3).ok, false);
  assert.equal(reviewPrescription(pending(), 'approved', [{ medicineId: 'paracetamol-tablet', quantity: 1 }], '', 3).ok, false);
  assert.equal(reviewPrescription(pending(), 'approved', [{ medicineId: 'tramadol-paracetamol', quantity: 1 }], '', 3).ok, false);
  assert.equal(reviewPrescription(pending(), 'partially_approved', [rx().requested[0]], '', 3).ok, false);
  const partial = reviewPrescription(pending(), 'partially_approved', [rx().requested[0]], 'Second item not accepted in demo', 3);
  assert.equal(partial.ok, true); assert.equal(prescriptionGrants([partial.record]).length, 1);
  assert.equal(reviewPrescription(pending(), 'partially_approved', rx().requested, 'All', 3).ok, false);
  const overstock = { ...pending(), requested: [{ medicineId: 'tramadol-paracetamol', quantity: 11 }] };
  assert.equal(reviewPrescription(overstock, 'approved', overstock.requested, '', 3).ok, false);
});
test('rejection and clearer-photo states grant nothing and need a reason', () => {
  for (const status of ['rejected', 'needs_clearer_photo']) {
    assert.equal(reviewPrescription(pending(), status, [], '', 3).ok, false);
    const result = reviewPrescription(pending(), status, rx().requested, 'Unreadable demo file', 3);
    assert.equal(result.ok, true); assert.deepEqual(result.record.approved, []); assert.deepEqual(prescriptionGrants([result.record]), []);
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
  const first = createDemoOrder(initialOrders(), cart(), contact, 'one', 4, grants);
  assert.equal(first.ok, true); assert.equal(first.order.total, 48); assert.equal(first.order.lines[0].approval.prescriptionId, 'RX-0001');
  assert.equal(remainingApprovals(grants, first.state.orders)[0].quantity, 1);
  assert.equal(createDemoOrder(first.state, cart(), contact, 'two', 5, grants).ok, false);
  assert.equal(createDemoOrder(first.state, [], contact, 'one', 5, grants).order.id, first.order.id);
  const cancelled = transitionDemoOrder(first.state, first.order.id, 'cancelled', '', 5);
  assert.equal(remainingApprovals(grants, cancelled.state.orders)[0].quantity, 1);
  assert.equal(createDemoOrder(initialOrders(), cart(), contact, 'stale', 5, []).ok, false);
  grants[0].quantity = 99;
  assert.equal(first.order.lines[0].approval.quantity, 3);
});
