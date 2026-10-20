import test from 'node:test';
import assert from 'node:assert/strict';
import { addItem, changeQuantity, cartTotal } from '../src/domain/cart.ts';
import { searchMedicines } from '../src/data/catalog.ts';
test('cart merges the same medicine and calculates unit prices', () => {
  const first = addItem([], 'paracetamol-tablet', 'healthplus', 3);
  const second = addItem(first.items, 'paracetamol-tablet', 'healthplus', 2);
  assert.equal(second.kind, 'added'); assert.equal(second.items.length, 1); assert.equal(second.items[0].quantity, 5); assert.equal(cartTotal(second.items), 25);
});
test('switching pharmacy requires explicit cart replacement', () => {
  const original = addItem([], 'paracetamol-tablet', 'healthplus', 5).items;
  assert.equal(addItem(original, 'cetirizine', 'rika', 1).kind, 'replace');
  assert.equal(original[0].pharmacyId, 'healthplus');
  const replaced = addItem(original, 'cetirizine', 'rika', 2, true);
  assert.equal(replaced.items.length, 1); assert.equal(replaced.items[0].pharmacyId, 'rika'); assert.equal(cartTotal(replaced.items), 14);
});
test('out-of-stock, Rx, invalid quantities and combined stock overflow are blocked', () => {
  assert.equal(addItem([], 'paracetamol-tablet', 'mercury', 1).kind, 'unavailable');
  assert.equal(addItem([], 'tramadol-paracetamol', 'healthplus', 1).kind, 'prescription');
  for (const q of [0, -1, 1.5, NaN]) assert.equal(addItem([], 'paracetamol-tablet', 'healthplus', q).kind, 'unavailable');
  const cart = addItem([], 'paracetamol-tablet', 'rika', 5).items;
  assert.equal(addItem(cart, 'paracetamol-tablet', 'rika', 2).kind, 'stock');
  assert.deepEqual(changeQuantity(cart, 'paracetamol-tablet', 7), cart);
  assert.deepEqual(changeQuantity(cart, 'paracetamol-tablet', 0), cart);
});
test('search matches generic, form and strength and handles empty results', () => {
  assert.equal(searchMedicines('acetaminophen').length, 2);
  assert.equal(searchMedicines('paracetamol tablet', 'OTC').length, 1);
  assert.equal(searchMedicines('paracetamol', 'Rx').length, 1);
  assert.equal(searchMedicines('missing medicine').length, 0);
});
