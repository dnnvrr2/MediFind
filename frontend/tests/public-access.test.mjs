import test from 'node:test';
import assert from 'node:assert/strict';
import { accountHome, pharmacyTabs, signedInDestination, needsCustomer, safeReturnTo } from '../src/domain/public-access.ts';

test('authentication preserves pharmacy and quantity without permitting external redirects', () => {
  const target = '/availability/paracetamol-tablet?pharmacy=healthplus&qty=3';
  assert.equal(safeReturnTo(target), target);
  assert.equal(safeReturnTo('/prescriptions/upload'), '/prescriptions/upload');
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/rider/login', '/account/sign-in', '/checkout\n', ['cart'], undefined]) {
    assert.equal(safeReturnTo(value), '/home');
  }
});

test('home and default sign-in retain the authenticated account portal', () => {
  assert.equal(accountHome(null), '/');
  assert.equal(accountHome({}), '/home');
  assert.equal(accountHome({ isStaff: true }), '/admin');
  assert.equal(accountHome({ pharmacyStatus: 'Approved' }), '/partner');
  assert.equal(accountHome({ pharmacyStatus: 'Pending' }), '/home');
  assert.equal(accountHome({ isRider: true }), '/rider');
  assert.equal(accountHome({ isStaff: true, pharmacyStatus: 'Approved' }), '/admin');
  assert.equal(signedInDestination(undefined, true), '/admin');
  assert.equal(signedInDestination('/home', false, { pharmacyStatus: 'Approved' }), '/partner');
  assert.equal(signedInDestination('/admin', false), '/home');
  assert.equal(signedInDestination('/partner', true), '/partner');
});

test('unapproved pharmacies expose application and profile instead of operational tabs', () => {
  assert.deepEqual(pharmacyTabs(false).map(item => item.key), ['dashboard', 'profile']);
  assert.deepEqual(pharmacyTabs(true).map(item => item.key), ['dashboard', 'inventory', 'prescriptions', 'orders', 'profile']);
});

test('public browsing stays open while customer records and submission routes require sign-in', () => {
  for (const path of ['/', '/search', '/medicine/paracetamol-tablet', '/availability/paracetamol-tablet', '/pharmacies', '/pharmacy/healthplus', '/help', '/privacy', '/terms', '/account/sign-in']) assert.equal(needsCustomer(path), false, path);
  for (const path of ['/home', '/cart', '/checkout', '/prescriptions', '/prescriptions/upload', '/prescriptions/private-id', '/orders', '/orders/private-id/tracking', '/profile/edit', '/rider', '/rider/deliveries', '/rider/delivery/123']) assert.equal(needsCustomer(path), true, path);
});

test('shared sign-in resumes approved rider destinations and guards non-riders', () => {
  assert.equal(safeReturnTo('/rider/delivery/123'), '/rider/delivery/123');
  assert.equal(safeReturnTo('/rider/login'), '/home');
  assert.equal(signedInDestination('/rider/delivery/123', false, { isRider: true }), '/rider/delivery/123');
  assert.equal(signedInDestination('/rider', false, {}), '/home');
  assert.equal(signedInDestination(undefined, false, { isRider: true }), '/rider');
});
