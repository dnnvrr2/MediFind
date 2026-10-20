import { medicines, pharmacies, offers } from '../data/catalog.ts';
import type { Medicine, Pharmacy } from '../data/catalog.ts';
import { approvalFor, type Approval } from './prescriptions.ts';
import type { CartItem } from './cart.ts';

export type Fulfillment = 'pickup' | 'delivery';
export type DeliveryAddress = { street: string; barangay: string; city: string; province: string; postalCode: string };
export type CheckoutDraft = { method: Fulfillment; name: string; phone: string; address: DeliveryAddress | null };
export type AddressErrors = Partial<Record<keyof DeliveryAddress, string>>;
export type CheckoutErrors = Partial<Record<'name' | 'phone' | 'address', string>>;
export type QuoteLine = { medicine: Medicine; quantity: number; unitPrice: number; subtotal: number; approval?: Approval };
export type CheckoutQuote = { ok: true; pharmacy: Pharmacy; lines: QuoteLine[]; subtotal: number; deliveryFee: number; total: number; payment: string; method: Fulfillment } | { ok: false; issue: string };

// Demonstration pricing only. Real delivery coverage and fees need a backend quote.
export const SAMPLE_DELIVERY_FEE = 50;
export const emptyAddress = (): DeliveryAddress => ({ street: '', barangay: '', city: '', province: '', postalCode: '' });
export const initialCheckout = (): CheckoutDraft => ({ method: 'pickup', name: '', phone: '', address: null });

export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (/^09\d{9}$/.test(compact)) return '+63' + compact.slice(1);
  if (/^\+?639\d{9}$/.test(compact)) return compact.startsWith('+') ? compact : '+' + compact;
  return null;
}

export function validateAddress(address: DeliveryAddress | null): AddressErrors {
  const errors: AddressErrors = {};
  if (!address?.street.trim()) errors.street = 'Enter the house/building and street.';
  if (!address?.barangay.trim()) errors.barangay = 'Enter the barangay.';
  if (!address?.city.trim()) errors.city = 'Enter the city or municipality.';
  if (!address?.province.trim()) errors.province = 'Enter the province.';
  if (address?.postalCode.trim() && !/^\d{4}$/.test(address.postalCode.trim())) errors.postalCode = 'Use a 4-digit postal code, or leave it blank.';
  return errors;
}

export function validateCheckout(draft: CheckoutDraft): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (!draft.name.trim()) errors.name = 'Enter the recipient’s full name.';
  if (!normalizePhone(draft.phone)) errors.phone = 'Enter a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.';
  if (draft.method === 'delivery' && Object.keys(validateAddress(draft.address)).length) errors.address = 'Add a complete delivery address before continuing.';
  return errors;
}

export function addressText(address: DeliveryAddress): string {
  return [address.street, address.barangay, address.city, address.province, address.postalCode].map(part => part.trim()).filter(Boolean).join(', ');
}

export function quoteCheckout(items: CartItem[], method: Fulfillment, grants: Approval[] = []): CheckoutQuote {
  if (!items.length) return { ok: false, issue: 'Your cart is empty.' };
  if (method !== 'pickup' && method !== 'delivery') return { ok: false, issue: 'Choose pickup or delivery.' };
  const pharmacy = pharmacies.find(p => p.id === items[0].pharmacyId);
  if (!pharmacy || items.some(i => i.pharmacyId !== pharmacy.id)) return { ok: false, issue: 'Checkout is limited to one pharmacy. Return to your cart.' };
  const lines: QuoteLine[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const medicine = medicines.find(m => m.id === item.medicineId);
    const offer = offers.find(o => o.medicineId === item.medicineId && o.pharmacyId === item.pharmacyId);
    if (!medicine || !offer) return { ok: false, issue: 'A cart item is no longer listed. Return to your cart.' };
    const approval = approvalFor(item, grants);
    if ((medicine.prescription || item.prescriptionId) && !approval) return { ok: false, issue: 'Prescription approval is missing, replaced, used, or insufficient. Remove the affected cart item and return to Prescriptions.' };
    if (seen.has(medicine.id)) return { ok: false, issue: 'A medicine appears more than once. Return to your cart to correct it.' };
    seen.add(medicine.id);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > offer.stock) return { ok: false, issue: `Check the available quantity for ${medicine.name} in your cart.` };
    lines.push({ ...(approval ? { approval: { ...approval } } : {}), medicine, quantity: item.quantity, unitPrice: offer.price, subtotal: Math.round(offer.price * 100) * item.quantity / 100 });
  }
  const subtotal = lines.reduce((cents, line) => cents + Math.round(line.subtotal * 100), 0) / 100;
  const deliveryFee = method === 'delivery' ? SAMPLE_DELIVERY_FEE : 0;
  return { ok: true, pharmacy, lines, subtotal, deliveryFee, total: Math.round((subtotal + deliveryFee) * 100) / 100, payment: method === 'delivery' ? 'Cash on Delivery' : 'Pay at Pharmacy', method };
}
