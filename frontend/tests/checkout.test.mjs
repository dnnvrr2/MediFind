import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteCheckout, validateCheckout, validateAddress, normalizePhone, initialCheckout, emptyAddress, addressText } from '../src/domain/checkout.ts';

const cart = [{ medicineId: 'paracetamol-tablet', pharmacyId: 'healthplus', quantity: 5 }];
const address = { street: '123 Sample Street', barangay: 'Sample Barangay', city: 'Cagayan de Oro City', province: 'Misamis Oriental', postalCode: '9000' };
const contact = { ...initialCheckout(), name: 'Preview Customer', phone: '09170000000' };

test('pickup and delivery share cart details but derive the correct fee and payment', () => {
  const pickup = quoteCheckout(cart, 'pickup'); const delivery = quoteCheckout(cart, 'delivery');
  assert.equal(pickup.ok, true); assert.equal(delivery.ok, true);
  assert.equal(pickup.subtotal, 25); assert.equal(pickup.total, 25); assert.equal(pickup.deliveryFee, 0); assert.equal(pickup.payment, 'Pay at Pharmacy');
  assert.equal(delivery.total, 75); assert.equal(delivery.deliveryFee, 50); assert.equal(delivery.payment, 'Cash on Delivery');
  assert.deepEqual(delivery.lines, pickup.lines); assert.equal(delivery.pharmacy.id, 'healthplus');
});

test('multiple medicines and fractional peso prices retain exact quantities and totals', () => {
  const quote = quoteCheckout([{ medicineId: 'paracetamol-tablet', pharmacyId: 'rika', quantity: 3 }, { medicineId: 'paracetamol-syrup', pharmacyId: 'rika', quantity: 2 }], 'delivery');
  assert.equal(quote.ok, true); assert.equal(quote.subtotal, 196.5); assert.equal(quote.total, 246.5);
  assert.equal(quote.lines[0].quantity, 3); assert.equal(quote.lines[1].medicine.unit, 'bottle');
});

test('recipient validation accepts local and international mobile formats', () => {
  assert.deepEqual(validateCheckout(contact), {});
  for (const phone of ['09170000000', '+639170000000', '639170000000', '+63 917 000 0000', '0917-000-0000']) assert.equal(normalizePhone(phone), '+639170000000');
  for (const phone of ['', '123', '0917000000', '091700000000', 'abc09170000000']) assert.ok(validateCheckout({ ...contact, phone }).phone);
  assert.ok(validateCheckout({ ...contact, name: '   ' }).name);
});

test('delivery requires a complete address while pickup retains but ignores it', () => {
  assert.ok(validateCheckout({ ...contact, method: 'delivery' }).address);
  assert.deepEqual(validateCheckout({ ...contact, method: 'delivery', address }), {});
  assert.deepEqual(validateCheckout({ ...contact, method: 'pickup', address: emptyAddress() }), {});
  assert.equal(Object.keys(validateAddress(null)).length, 4);
  assert.ok(validateAddress({ ...address, postalCode: '90A0' }).postalCode);
  assert.deepEqual(validateAddress({ ...address, postalCode: '' }), {});
  assert.equal(addressText(address), '123 Sample Street, Sample Barangay, Cagayan de Oro City, Misamis Oriental, 9000');
});

test('checkout blocks empty, mixed-pharmacy, unavailable, duplicate, prescription and malformed carts', () => {
  const invalid = [[], [...cart, { medicineId: 'cetirizine', pharmacyId: 'rika', quantity: 1 }], [{ ...cart[0], quantity: 41 }], [{ ...cart[0], quantity: 0 }], [{ ...cart[0], quantity: 1.5 }], [{ ...cart[0], medicineId: 'missing' }], [{ ...cart[0], pharmacyId: 'mercury' }], [{ ...cart[0], medicineId: 'tramadol-paracetamol' }], [...cart, ...cart]];
  for (const items of invalid) assert.equal(quoteCheckout(items, 'pickup').ok, false);
  assert.equal(quoteCheckout(cart, 'unknown').ok, false);
});
