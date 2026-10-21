import { useSyncExternalStore } from 'react';
export type Medicine = {
  live?: boolean; id: string; name: string; generic: string; strength: string; form: string;
  unit: string; category: string; prescription: boolean; description: string;
};
export type Pharmacy = { contactNumbers?: string[]; point?: { lat: number; lon: number } | null; live?: boolean; isOpen?: boolean; id: string; name: string; address: string; hours: string; phone: string };
export type Offer = { medicineId: string; pharmacyId: string; price: number; stock: number };

export const medicines: Medicine[] = [
  { id: 'paracetamol-tablet', name: 'Paracetamol', generic: 'Paracetamol (acetaminophen)', strength: '500 mg', form: 'Tablet', unit: 'tablet', category: 'Pain relief', prescription: false, description: 'Compare this medicine’s availability and price at participating pharmacies.' },
  { id: 'paracetamol-syrup', name: 'Paracetamol', generic: 'Paracetamol (acetaminophen)', strength: '250 mg / 5 mL', form: 'Syrup · 60 mL', unit: 'bottle', category: 'Pain relief', prescription: false, description: 'A different formulation from the tablet. Confirm the exact medicine and strength with your pharmacist.' },
  { id: 'cetirizine', name: 'Cetirizine', generic: 'Cetirizine', strength: '10 mg', form: 'Tablet', unit: 'tablet', category: 'Allergy', prescription: false, description: 'Browse sample pharmacy offers for this medicine.' },
  { id: 'tramadol-paracetamol', name: 'Tramadol + Paracetamol', generic: 'Tramadol + paracetamol', strength: '37.5 mg / 325 mg', form: 'Tablet', unit: 'tablet', category: 'Pain relief', prescription: true, description: 'Requires a prescription and pharmacist review. Explore simulated review and ordering in Prescriptions.' },
];
export const pharmacies: Pharmacy[] = [
  { id: 'healthplus', name: 'HealthPlus Pharmacy', address: 'Corrales Avenue, Cagayan de Oro City', hours: '8:00 AM – 9:00 PM', phone: 'Contact information coming soon' },
  { id: 'rika', name: 'Rika Drugstore', address: 'Carmen, Cagayan de Oro City', hours: '8:00 AM – 8:00 PM', phone: 'Contact information coming soon' },
  { id: 'mercury', name: 'Mercury Drug', address: 'Corrales Avenue, Cagayan de Oro City', hours: '7:00 AM – 10:00 PM', phone: 'Contact information coming soon' },
];
export const offers: Offer[] = [
  { medicineId: 'paracetamol-tablet', pharmacyId: 'healthplus', price: 5, stock: 40 },
  { medicineId: 'paracetamol-tablet', pharmacyId: 'rika', price: 5.5, stock: 6 },
  { medicineId: 'paracetamol-tablet', pharmacyId: 'mercury', price: 5.25, stock: 0 },
  { medicineId: 'paracetamol-syrup', pharmacyId: 'healthplus', price: 85, stock: 12 },
  { medicineId: 'paracetamol-syrup', pharmacyId: 'rika', price: 90, stock: 4 },
  { medicineId: 'cetirizine', pharmacyId: 'healthplus', price: 8, stock: 20 },
  { medicineId: 'cetirizine', pharmacyId: 'rika', price: 7, stock: 15 },
  { medicineId: 'tramadol-paracetamol', pharmacyId: 'healthplus', price: 24, stock: 10 },
];
export const money = (amount: number) => `₱${amount.toFixed(2)}`;
export function searchMedicines(query: string, filter = 'All') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return medicines.filter(m => words.every(word => `${m.name} ${m.generic} ${m.strength} ${m.form}`.toLowerCase().includes(word)) && (filter === 'All' || (filter === 'OTC' ? !m.prescription : m.prescription)));
}

let catalogVersion = 0;
const catalogListeners = new Set<() => void>();
export function useCatalog() { return useSyncExternalStore(listener => { catalogListeners.add(listener); return () => { catalogListeners.delete(listener); }; }, () => catalogVersion, () => catalogVersion); }
export function applyPharmacyCatalog(value: { medicines: Medicine[]; pharmacies: Pharmacy[]; offers: Offer[] }) {
  const sampleMedicines = medicines.filter(m => !m.live);
  const samplePharmacies = pharmacies.filter(p => !p.live);
  const sampleOffers = offers.filter(o => samplePharmacies.some(p => p.id === o.pharmacyId));
  medicines.splice(0, medicines.length, ...sampleMedicines, ...value.medicines);
  pharmacies.splice(0, pharmacies.length, ...samplePharmacies, ...value.pharmacies);
  offers.splice(0, offers.length, ...sampleOffers, ...value.offers);
  catalogVersion++;
  catalogListeners.forEach(listener => listener());
}
