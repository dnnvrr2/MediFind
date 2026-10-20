import { cdoBarangays } from '../data/cdo-barangays.ts';

const clean = (value: string) => value.toLowerCase().trim().replace(/^brgy\.?\s+|^barangay\s+/i, '').replace(/\s+/g, ' ');
const isCdo = (value: string) => /\bcagayan de oro(?: city)?\b|\bcdo\b/i.test(value);

// Resolve only a public area locally. Never geocode a customer's street or use
// the browsing location as a substitute for an order's saved destination.
export function destinationArea(address: string, barangay = '', city = '') {
  if (city.trim() ? !isCdo(city) : !isCdo(address)) return null;
  const names = barangay.trim() ? [clean(barangay)] : address.split(',').map(clean);
  const match = cdoBarangays.find(place => names.includes(clean(place.name)));
  return match
    ? { area: `${match.name}, Cagayan de Oro City`, point: { lat: match.lat, lon: match.lon } }
    : { area: 'Cagayan de Oro City', point: null };
}
