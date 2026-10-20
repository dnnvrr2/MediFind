import { medicines, offers } from '../data/catalog.ts';
import { approvalFor, type Approval } from './prescriptions.ts';
export type CartItem = { medicineId: string; pharmacyId: string; quantity: number; prescriptionId?: string; revision?: number };
export type AddResult = { kind: 'added'; items: CartItem[] } | { kind: 'replace' | 'unavailable' | 'prescription' | 'stock'; items: CartItem[] };
export function addItem(items: CartItem[], medicineId: string, pharmacyId: string, quantity: number, replace = false, grants: Approval[] = [], prescriptionId?: string, revision?: number): AddResult {
  const medicine = medicines.find(m => m.id === medicineId);
  const offer = offers.find(o => o.medicineId === medicineId && o.pharmacyId === pharmacyId);
  if (!medicine || !offer || offer.stock < 1 || !Number.isInteger(quantity) || quantity < 1) return { kind: 'unavailable', items };
  if ((medicine.prescription || prescriptionId) && !approvalFor({ medicineId, pharmacyId, quantity, prescriptionId, revision }, grants)) return { kind: 'prescription', items };
  const different = items.some(i => i.pharmacyId !== pharmacyId);
  const base = different && replace ? [] : items;
  const existing = base.find(i => i.medicineId === medicineId && i.pharmacyId === pharmacyId);
  if (existing && (existing.prescriptionId !== prescriptionId || existing.revision !== revision)) return { kind: 'prescription', items };
  if (prescriptionId && !approvalFor({ medicineId, pharmacyId, quantity: (existing?.quantity ?? 0) + quantity, prescriptionId, revision }, grants)) return { kind: 'prescription', items };
  if ((existing?.quantity ?? 0) + quantity > offer.stock) return { kind: 'stock', items };
  if (different && !replace) return { kind: 'replace', items };
  return { kind: 'added', items: existing ? base.map(i => i === existing ? { ...i, quantity: i.quantity + quantity } : i) : [...base, { medicineId, pharmacyId, quantity, ...(prescriptionId ? { prescriptionId, revision } : {}) }] };
}
export function changeQuantity(items: CartItem[], medicineId: string, quantity: number, grants: Approval[] = []): CartItem[] {
  if (!Number.isInteger(quantity) || quantity < 1) return items;
  return items.map(i => {
    const offer = offers.find(o => o.medicineId === medicineId && o.pharmacyId === i.pharmacyId);
    return i.medicineId === medicineId && offer && quantity <= offer.stock && (!(i.prescriptionId || medicines.find(m => m.id === i.medicineId)?.prescription) || !!approvalFor({ ...i, quantity }, grants)) ? { ...i, quantity } : i;
  });
}
export const cartTotal = (items: CartItem[]) => items.reduce((sum, i) => sum + (offers.find(o => o.medicineId === i.medicineId && o.pharmacyId === i.pharmacyId)?.price ?? 0) * i.quantity, 0);
