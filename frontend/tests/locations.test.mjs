import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultArea, matchesArea, normalizeArea } from '../src/domain/locations.ts';
import { pharmacies, offers } from '../src/data/catalog.ts';

test('location input normalizes CDO and whitespace without substituting unsupported cities', () => {
  assert.equal(normalizeArea('  cdo  '), defaultArea);
  assert.equal(normalizeArea('Cagayan de Oro'), defaultArea);
  assert.equal(normalizeArea('  Cebu   City '), 'Cebu City');
  assert.equal(normalizeArea('  '), '');
});

test('area changes consistently filter sample pharmacies and their medicine offers', () => {
  const local = area => pharmacies.filter(p => matchesArea(p.address, area));
  assert.equal(local(defaultArea).length, 3);
  assert.deepEqual(local('Carmen, Cagayan de Oro City').map(p => p.id), ['rika']);
  assert.deepEqual(local('Corrales Avenue').map(p => p.id), ['healthplus', 'mercury']);
  assert.equal(local('Cebu City').length, 0);
  assert.equal(local('').length, 0);
  const ids = new Set(local('Carmen').map(p => p.id));
  const listings = offers.filter(o => ids.has(o.pharmacyId));
  assert.ok(listings.length > 0);
  assert.ok(listings.every(o => o.pharmacyId === 'rika'));
});
