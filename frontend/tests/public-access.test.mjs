import test from 'node:test';
import assert from 'node:assert/strict';
import { needsCustomer, safeReturnTo } from '../src/domain/public-access.ts';

test('authentication preserves pharmacy and quantity without permitting external redirects', () => {
  const target = '/availability/paracetamol-tablet?pharmacy=healthplus&qty=3';
  assert.equal(safeReturnTo(target), target);
  assert.equal(safeReturnTo('/prescriptions/upload'), '/prescriptions/upload');
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/rider', '/account/sign-in', '/checkout\n', ['cart'], undefined]) {
    assert.equal(safeReturnTo(value), '/home');
  }
});

test('public browsing stays open while customer records and submission routes require sign-in', () => {
  for (const path of ['/', '/search', '/medicine/paracetamol-tablet', '/availability/paracetamol-tablet', '/pharmacies', '/pharmacy/healthplus', '/help', '/privacy', '/terms', '/account/sign-in', '/rider']) assert.equal(needsCustomer(path), false, path);
  for (const path of ['/home', '/cart', '/checkout', '/prescriptions', '/prescriptions/upload', '/prescriptions/private-id', '/orders', '/orders/private-id/tracking', '/profile/edit']) assert.equal(needsCustomer(path), true, path);
});
