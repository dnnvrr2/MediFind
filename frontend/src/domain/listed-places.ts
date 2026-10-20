import { areaViewport } from './maps.ts';
import { suggestedAreas } from './locations.ts';
import { validPoint, type Place } from './places.ts';
import { cdoBarangays } from '../data/cdo-barangays.ts';
import { insideCdo } from './cdo.ts';

export const listedAreas: Place[] = [...suggestedAreas.map((label, i) => {
  const view = areaViewport(label)!;
  return { id: `sample-area-${i}`, label, description: 'Sample area · Approximate area center', lat: (view.south + view.north) / 2, lon: (view.west + view.east) / 2 };
}), ...cdoBarangays.map(b => ({ id: `cdo-${b.name}`, label: `${b.name}, Cagayan de Oro City`, description: 'CDO barangay · Approximate map point', lat: b.lat, lon: b.lon }))];

export function filterListedPlaces(query: string, saved: Place[] = []): Place[] {
  const normalized = query.trim().toLowerCase().replace(/\bcdo\b/g, 'cagayan de oro');
  const words = normalized.split(/[\s,]+/).filter(Boolean);
  const unique = new Map<string, Place>();
  for (const place of [...listedAreas, ...saved]) {
    if (!validPoint(place) || typeof place.label !== 'string' || typeof place.description !== 'string' || typeof place.id !== 'string') continue;
    if (!insideCdo(place)) continue;
    const key = place.label.toLowerCase();
    if (!unique.has(key) && words.every(word => `${place.label} ${place.description}`.toLowerCase().includes(word))) unique.set(key, place);
  }
  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
}
