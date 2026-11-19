import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPixel, pointAtPixel, offsetMapPoint, visibleMapTiles } from '../src/domain/map-camera.ts';

test('map coordinates round-trip and pin offsets use the current zoom', () => {
  const point = { lat: 8.4772, lon: 124.647 };
  for (const zoom of [5, 14, 19]) {
    const pixel = mapPixel(point, zoom);
    const reversed = pointAtPixel(pixel, zoom);
    assert.ok(Math.abs(reversed.lat - point.lat) < 0.000001);
    assert.ok(Math.abs(reversed.lon - point.lon) < 0.000001);
    const offset = offsetMapPoint(point, zoom, 15, -20);
    assert.ok(offset.lat > point.lat && offset.lon > point.lon);
    assert.ok(Math.abs(mapPixel(offset, zoom).x - pixel.x - 15) < 0.000001);
    assert.ok(Math.abs(mapPixel(offset, zoom).y - pixel.y + 20) < 0.000001);
  }
});

test('the tile grid includes the intersecting map tiles without requesting outside the viewport', () => {
  assert.deepEqual(visibleMapTiles({ x: 246, y: 256 }, 20, 256, 3), [
    { x: 0, y: 1, left: -246, top: 0 },
    { x: 1, y: 1, left: 10, top: 0 },
  ]);
});
