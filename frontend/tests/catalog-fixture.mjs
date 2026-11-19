import { applyPharmacyCatalog } from '../src/data/catalog.ts';

const medicines = [
  { id: 'paracetamol-tablet', name: 'Paracetamol', generic: 'Paracetamol (acetaminophen)', strength: '500 mg', form: 'Tablet', unit: 'tablet', category: 'Pain relief', prescription: false, description: 'Compare this medicine’s availability and price at participating pharmacies.' },
  { id: 'paracetamol-syrup', name: 'Paracetamol', generic: 'Paracetamol (acetaminophen)', strength: '250 mg / 5 mL', form: 'Syrup · 60 mL', unit: 'bottle', category: 'Pain relief', prescription: false, description: 'A different formulation from the tablet. Confirm the exact medicine and strength with your pharmacist.' },
  { id: 'cetirizine', name: 'Cetirizine', generic: 'Cetirizine', strength: '10 mg', form: 'Tablet', unit: 'tablet', category: 'Allergy', prescription: false, description: 'Browse sample pharmacy offers for this medicine.' },
  { id: 'tramadol-paracetamol', name: 'Tramadol + Paracetamol', generic: 'Tramadol + paracetamol', strength: '37.5 mg / 325 mg', form: 'Tablet', unit: 'tablet', category: 'Pain relief', prescription: true, description: 'Requires a prescription and pharmacist review. Explore simulated review and ordering in Prescriptions.' },
];
const pharmacies = [
  { id: 'healthplus', name: 'HealthPlus Pharmacy', address: 'Corrales Avenue, Cagayan de Oro City', hours: '8:00 AM – 9:00 PM', phone: 'Contact information coming soon' },
  { id: 'rika', name: 'Rika Drugstore', address: 'Carmen, Cagayan de Oro City', hours: '8:00 AM – 8:00 PM', phone: 'Contact information coming soon' },
  { id: 'mercury', name: 'Mercury Drug', address: 'Corrales Avenue, Cagayan de Oro City', hours: '7:00 AM – 10:00 PM', phone: 'Contact information coming soon' },
];
const offers = [
  { medicineId: 'paracetamol-tablet', pharmacyId: 'healthplus', price: 5, stock: 40 },
  { medicineId: 'paracetamol-tablet', pharmacyId: 'rika', price: 5.5, stock: 6 },
  { medicineId: 'paracetamol-tablet', pharmacyId: 'mercury', price: 5.25, stock: 0 },
  { medicineId: 'paracetamol-syrup', pharmacyId: 'healthplus', price: 85, stock: 12 },
  { medicineId: 'paracetamol-syrup', pharmacyId: 'rika', price: 90, stock: 4 },
  { medicineId: 'cetirizine', pharmacyId: 'healthplus', price: 8, stock: 20 },
  { medicineId: 'cetirizine', pharmacyId: 'rika', price: 7, stock: 15 },
  { medicineId: 'tramadol-paracetamol', pharmacyId: 'healthplus', price: 24, stock: 10 },
];
applyPharmacyCatalog({
  medicines: medicines.map(medicine => ({ ...medicine, live: true })),
  pharmacies: pharmacies.map(pharmacy => ({ ...pharmacy, live: true, isOpen: pharmacy.id !== 'mercury' })),
  offers,
});
