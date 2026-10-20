import { cdoBarangays } from '../data/cdo-barangays.ts';
import type { MapPoint } from './places.ts';

function inRing(point: MapPoint, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const cross = (point.lon - xi) * (yj - yi) - (point.lat - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && point.lon >= Math.min(xi, xj) && point.lon <= Math.max(xi, xj) && point.lat >= Math.min(yi, yj) && point.lat <= Math.max(yi, yj)) return true;
    if ((yi > point.lat) !== (yj > point.lat) && point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function cdoBarangayAt(point: MapPoint) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return null;
  return cdoBarangays.find(barangay => barangay.polygons.some(polygon => inRing(point, polygon[0]) && !polygon.slice(1).some(hole => inRing(point, hole)))) ?? null;
}

export function insideCdo(point: MapPoint): boolean { return cdoBarangayAt(point) !== null; }

export function isCdoAreaName(value: string): boolean {
  const name = value.trim().toLowerCase();
  return ['cdo', 'cagayan de oro', 'cagayan de oro city', 'corrales avenue', 'corrales avenue, cagayan de oro city'].includes(name) || cdoBarangays.some(b => [b.name.toLowerCase(), `${b.name}, cagayan de oro city`.toLowerCase()].includes(name));
}
