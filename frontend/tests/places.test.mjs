import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaces, validPoint } from '../src/domain/places.ts';
import { osmEmbedUrl, osmPointUrl, pointViewport } from '../src/domain/maps.ts';

const feature = (properties = {}, coordinates = [124.65, 8.48]) => ({ type: 'Feature', properties: { name: 'CDO landmark', city: 'Cagayan de Oro', countrycode: 'PH', country: 'Philippines', osm_type: 'N', osm_id: 1, ...properties }, geometry: { type: 'Point', coordinates } });

test('place suggestions retain coordinates and remove duplicates, invalid geometry, and foreign results', () => {
  const results = parsePlaces({ features: [feature(), feature({ osm_id: 2 }), feature({ countrycode: 'US' }), feature({}, [124, 999]), null, {}] });
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], { lat: 8.48, lon: 124.65, id: 'N-1', label: 'CDO landmark, Cagayan de Oro', description: 'Philippines' });
  assert.deepEqual(parsePlaces(null), []);
  assert.equal(validPoint({ lat: '8.23', lon: 124 }), false);
});

test('geocoded place preview centers the embedded map and pin on the returned point', () => {
  const point = { lat: 8.23, lon: 124.24 };
  const view = pointViewport(point);
  assert.ok(view.west < point.lon && view.east > point.lon);
  assert.ok(view.south < point.lat && view.north > point.lat);
  const url = new URL(osmEmbedUrl(view, point));
  assert.equal(url.searchParams.get('marker'), '8.23,124.24');
  assert.equal(new URL(osmPointUrl(point)).searchParams.get('mlat'), '8.23');
  assert.equal(pointViewport({ lat: NaN, lon: 0 }), null);
});
