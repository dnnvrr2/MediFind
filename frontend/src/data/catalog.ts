import { useSyncExternalStore } from 'react';
export type Medicine = {
  live?: boolean; id: string; name: string; generic: string; strength: string; form: string;
  unit: string; category: string; prescription: boolean; description: string;
};
export type Pharmacy = { contactNumbers?: string[]; point?: { lat: number; lon: number } | null; live?: boolean; isOpen?: boolean; acceptsOrders?: boolean; id: string; name: string; address: string; hours: string; phone: string };
export type Offer = { medicineId: string; pharmacyId: string; price: number; stock: number };

export const medicines: Medicine[] = [];
export const pharmacies: Pharmacy[] = [];
export const offers: Offer[] = [];
export const money = (amount: number) => `₱${amount.toFixed(2)}`;
export function searchMedicines(query: string, filter = 'All') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return medicines.filter(m => words.every(word => `${m.name} ${m.generic} ${m.strength} ${m.form}`.toLowerCase().includes(word)) && (filter === 'All' || (filter === 'OTC' ? !m.prescription : m.prescription)));
}

let catalogState: { status: 'loading' | 'ready' | 'unavailable' } = { status: 'loading' };
const catalogListeners = new Set<() => void>();
export function useCatalog() { return useSyncExternalStore(listener => { catalogListeners.add(listener); return () => { catalogListeners.delete(listener); }; }, () => catalogState, () => catalogState); }
export function markCatalogUnavailable() {
  if (catalogState.status !== 'loading') return;
  catalogState = { status: 'unavailable' };
  catalogListeners.forEach(listener => listener());
}

export function applyPharmacyCatalog(value: { medicines: Medicine[]; pharmacies: Pharmacy[]; offers: Offer[] }) {
  medicines.splice(0, medicines.length, ...value.medicines);
  pharmacies.splice(0, pharmacies.length, ...value.pharmacies);
  offers.splice(0, offers.length, ...value.offers);
  catalogState = { status: 'ready' };
  catalogListeners.forEach(listener => listener());
}
