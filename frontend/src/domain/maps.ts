import { normalizeArea } from './locations.ts';
import { validPoint, type MapPoint } from './places.ts';

export type MapViewport = { south: number; north: number; west: number; east: number };

// Area overview extents, not pharmacy coordinates or precise delivery locations.
const city: MapViewport = { south: 8.445, north: 8.515, west: 124.61, east: 124.69 };
const carmen: MapViewport = { south: 8.46, north: 8.495, west: 124.615, east: 124.65 };
const corrales: MapViewport = { south: 8.473, north: 8.493, west: 124.642, east: 124.657 };

export function areaViewport(area: string): MapViewport | null {
  const value = normalizeArea(area).toLowerCase();
  if (value === 'carmen' || value === 'carmen, cagayan de oro city') return carmen;
  if (value === 'corrales avenue' || value === 'corrales avenue, cagayan de oro city') return corrales;
  if (value === 'cagayan de oro city') return city;
  return null;
}

export function osmSearchUrl(query: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query.trim())}`;
}

export function osmEmbedUrl(viewport: MapViewport, point?: MapPoint | null): string | null {
  const { west, south, east, north } = viewport;
  if (![west, south, east, north].every(Number.isFinite) || west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${west},${south},${east},${north}`)}&layer=mapnik${validPoint(point) ? `&marker=${point.lat},${point.lon}` : ''}`;
}

export function pointViewport(point: MapPoint): MapViewport | null {
  if (!validPoint(point)) return null;
  return { west: Math.max(-180, point.lon - 0.008), east: Math.min(180, point.lon + 0.008), south: Math.max(-90, point.lat - 0.006), north: Math.min(90, point.lat + 0.006) };
}

export function osmPointUrl(point: MapPoint): string {
  return validPoint(point) ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=16/${point.lat}/${point.lon}` : 'https://www.openstreetmap.org';
}

export function osmAreaUrl(area: string): string {
  const view = areaViewport(area);
  if (!view) return osmSearchUrl(area);
  const lat = (view.south + view.north) / 2;
  const lon = (view.west + view.east) / 2;
  return `https://www.openstreetmap.org/#map=${area.trim().toLowerCase() === 'cagayan de oro city' || area.trim().toLowerCase() === 'cdo' ? 13 : 15}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
}
