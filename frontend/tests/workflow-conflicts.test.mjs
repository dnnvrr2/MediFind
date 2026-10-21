import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePendingRecords } from '../src/domain/prescription-sync.ts';
import { navigationPortal } from '../src/domain/public-access.ts';
import { isCurrentOrder, statusInfo, timelineSteps, createDemoOrder, initialOrders } from '../src/domain/orders.ts';
import { prescriptionLabel } from '../src/domain/prescriptions.ts';

test('remote polling preserves unsynced new files and local edits until acknowledgement', () => {
  const selected = { id: 'new', createdAt: 20, file: { uri: 'file:still-selected' }, status: 'pending' };
  const edited = { id: 'existing', createdAt: 10, status: 'pending', requested: [2] };
  const pending = new Map([['new', selected], ['existing', edited]]);
  const merged = mergePendingRecords([{ id: 'existing', createdAt: 10, status: 'draft', requested: [] }], pending);
  assert.equal(merged[0], selected); assert.equal(merged[1], edited);
  assert.equal(merged[0].file.uri, 'file:still-selected');
  pending.delete('existing');
  assert.equal(mergePendingRecords([{ id: 'existing', createdAt: 10, status: 'approved' }], pending)[1].status, 'approved');
});

test('shared information screens retain each role portal while explicit browsing stays available', () => {
  for (const path of ['/help', '/privacy', '/terms', '/partnership', '/account/sign-in']) {
    assert.equal(navigationPortal(path, { isStaff: true }), 'admin');
    assert.equal(navigationPortal(path, { isRider: true }), 'rider');
    assert.equal(navigationPortal(path, { pharmacyStatus: 'Approved' }), 'partner');
    assert.equal(navigationPortal(path, null), 'guest');
  }
  assert.equal(navigationPortal('/search', { isStaff: true }), 'customer');
});

test('delivery issues and retries remain current until a completed return', () => {
  for (const status of ['delivery_issue', 'delivery_retry', 'returning', 'rider_collected']) { assert.equal(isCurrentOrder({ status }), true); assert.ok(statusInfo[status]); }
  assert.equal(isCurrentOrder({ status: 'returned' }), false);
  assert.ok(timelineSteps('delivery', true).some(step => step.status === 'rider_collected'));
});

test('managed reviews use pharmacist wording and sample reviews remain clearly labeled', () => {
  assert.equal(prescriptionLabel({ managed: true, status: 'approved' }), 'Pharmacist approved');
  assert.match(prescriptionLabel({ managed: false, status: 'approved' }), /demo/);
});

test('reusing a checkout key cannot silently replace another cart', () => {
  const draft = { method: 'pickup', name: 'Customer', phone: '09123456789', address: null };
  const cart = [{ medicineId: 'cetirizine', pharmacyId: 'healthplus', quantity: 1 }];
  const first = createDemoOrder(initialOrders(), cart, draft, 'one', 1);
  assert.equal(first.ok, true);
  assert.equal(createDemoOrder(first.state, [{ ...cart[0], quantity: 2 }], draft, 'one', 2).ok, false);
});
