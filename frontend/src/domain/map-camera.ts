import type { MapPoint } from './places.ts';

export const tileSize = 256;
const maxLatitude = 85.05112878;
export type MapPixel = { x: number; y: number };

export function mapPixel(point: MapPoint, zoom: number): MapPixel {
  const scale = tileSize * 2 ** zoom;
  const latitude = Math.max(-maxLatitude, Math.min(maxLatitude, point.lat)) * Math.PI / 180;
  return {
    x: scale * (point.lon + 180) / 360,
    y: scale * (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2,
  };
}

export function pointAtPixel(pixel: MapPixel, zoom: number): MapPoint {
  const scale = tileSize * 2 ** zoom;
  const x = Math.max(0, Math.min(scale, pixel.x));
  const y = Math.max(0, Math.min(scale, pixel.y));
  return {
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI,
    lon: x / scale * 360 - 180,
  };
}

export function offsetMapPoint(center: MapPoint, zoom: number, dx: number, dy: number): MapPoint {
  const origin = mapPixel(center, zoom);
  return pointAtPixel({ x: origin.x + dx, y: origin.y + dy }, zoom);
}

export function visibleMapTiles(origin: MapPixel, width: number, height: number, zoom: number) {
  const tiles = [];
  const limit = 2 ** zoom - 1;
  for (let x = Math.max(0, Math.floor(origin.x / tileSize)); x <= Math.min(limit, Math.ceil((origin.x + width) / tileSize) - 1); x++) {
    for (let y = Math.max(0, Math.floor(origin.y / tileSize)); y <= Math.min(limit, Math.ceil((origin.y + height) / tileSize) - 1); y++) {
      tiles.push({ x, y, left: x * tileSize - origin.x, top: y * tileSize - origin.y });
    }
  }
  return tiles;
}
