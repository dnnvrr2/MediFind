import { insideCdo } from './cdo.ts';
export type MapPoint = { lat: number; lon: number };
export type Place = MapPoint & { id: string; label: string; description: string };

export function validPoint(value: unknown): value is MapPoint {
  if (!value || typeof value !== 'object') return false;
  const p = value as MapPoint;
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

export function parsePlaces(body: unknown): Place[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const result: Place[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const row = feature as { properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown[] } };
    const props = row?.properties;
    const coords = row?.geometry?.coordinates;
    if (!props || !Array.isArray(coords) || row.geometry?.type !== 'Point') continue;
    const point = { lat: coords[1] as number, lon: coords[0] as number };
    if (!validPoint(point) || String(props.countrycode).toUpperCase() !== 'PH' || !insideCdo(point)) continue;
    const text = (key: string) => typeof props[key] === 'string' ? (props[key] as string).trim() : '';
    const name = text('name') || text('street') || text('city');
    if (!name) continue;
    const label = [...new Set([name, text('city')].filter(Boolean))].join(', ');
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    result.push({ ...point, id: `${props.osm_type}-${props.osm_id}`, label, description: [...new Set([text('district'), text('state'), text('country')].filter(Boolean))].join(', ') });
  }
  return result.slice(0, 5);
}
