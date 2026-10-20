import test from 'node:test';
import assert from 'node:assert/strict';
import { cdoBarangays } from '../src/data/cdo-barangays.ts';
import { insideCdo, cdoBarangayAt, isCdoAreaName } from '../src/domain/cdo.ts';
import { filterListedPlaces } from '../src/domain/listed-places.ts';
import { parsePlaces } from '../src/domain/places.ts';

test('all 80 CDO barangays have distinct names and interior map points', () => {
  assert.equal(cdoBarangays.length, 80);
  assert.equal(new Set(cdoBarangays.map(b => b.name)).size, 80);
  for (const b of cdoBarangays) {
    assert.equal(cdoBarangayAt(b)?.name, b.name, b.name);
    assert.ok(filterListedPlaces(b.name).some(p => p.label === `${b.name}, Cagayan de Oro City`), b.name);
  }
});

test('outside CDO points and stale outside-city saved places are excluded', () => {
  for (const point of [{ lat: 8.23, lon: 124.24 }, { lat: 10.3157, lon: 123.8854 }, { lat: 14.5995, lon: 120.9842 }, { lat: NaN, lon: 124 }]) assert.equal(insideCdo(point), false);
  assert.equal(isCdoAreaName('Cebu City'), false);
  assert.equal(isCdoAreaName('Carmen, Cagayan de Oro City'), true);
  assert.deepEqual(filterListedPlaces('Iligan', [{ id: 'stale', label: 'Iligan', description: 'Philippines', lat: 8.23, lon: 124.24 }]), []);
  assert.deepEqual(parsePlaces({ features: [{ properties: { name: 'Iligan', countrycode: 'PH' }, geometry: { type: 'Point', coordinates: [124.24, 8.23] } }] }), []);
});
