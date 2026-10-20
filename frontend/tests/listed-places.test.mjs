import test from 'node:test';
import assert from 'node:assert/strict';
import { filterListedPlaces } from '../src/domain/listed-places.ts';

test('bundled areas filter instantly by partial name and CDO without a geocoder', () => {
  assert.equal(filterListedPlaces('').length, 82);
  assert.equal(filterListedPlaces('cdo').length, 82);
  assert.equal(filterListedPlaces('carm')[0].label, 'Carmen, Cagayan de Oro City');
  assert.equal(filterListedPlaces('corr')[0].label, 'Corrales Avenue, Cagayan de Oro City');
  assert.deepEqual(filterListedPlaces('unknown city'), []);
});

test('saved geocoder coordinates are reused, deduplicated, and validated', () => {
  const place = { id: 'saved-1', label: 'Local landmark, Cagayan de Oro City', description: 'Philippines', lat: 8.48, lon: 124.65 };
  const matches = filterListedPlaces('local landmark', [place, { ...place, id: 'duplicate' }, null, { ...place, lat: 999 }]);
  assert.deepEqual(matches, [place]);
});
