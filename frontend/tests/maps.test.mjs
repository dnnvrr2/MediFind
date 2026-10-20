import test from 'node:test';
import assert from 'node:assert/strict';
import { areaViewport, osmAreaUrl, osmEmbedUrl, osmSearchUrl } from '../src/domain/maps.ts';

test('sample areas have overview maps while unknown places never get a misleading default', () => {
  assert.deepEqual(areaViewport('CDO'), areaViewport('Cagayan de Oro City'));
  assert.ok(areaViewport('Carmen, Cagayan de Oro City'));
  assert.ok(areaViewport('Corrales Avenue'));
  assert.equal(areaViewport('Cebu City'), null);
  assert.equal(areaViewport(''), null);
  assert.match(osmAreaUrl('Cebu City'), /\/search\?query=Cebu%20City$/);
});

test('embedded maps validate geographic bounds and do not create unverified pharmacy pins', () => {
  const url = new URL(osmEmbedUrl(areaViewport('CDO')));
  assert.equal(url.origin, 'https://www.openstreetmap.org');
  assert.equal(url.pathname, '/export/embed.html');
  assert.equal(url.searchParams.get('layer'), 'mapnik');
  assert.equal(url.searchParams.has('marker'), false);
  assert.equal(url.searchParams.get('bbox'), '124.61,8.445,124.69,8.515');
  for (const bounds of [
    { west: 5, east: 1, south: 1, north: 2 },
    { west: -181, east: 1, south: 1, north: 2 },
    { west: 1, east: 2, south: 5, north: 2 },
    { west: 1, east: 2, south: 1, north: Infinity },
  ]) assert.equal(osmEmbedUrl(bounds), null);
});

test('external address searches encode user text without allowing another URL origin', () => {
  const query = 'Carmen & Corrales #1, Cagayan de Oro City';
  const url = new URL(osmSearchUrl(query));
  assert.equal(url.origin, 'https://www.openstreetmap.org');
  assert.equal(url.searchParams.get('query'), query);
  assert.equal(url.hash, '');
});
