import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { setImmediate as nextTurn } from 'node:timers/promises';

const source = readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function loadClient(fetch) {
  const stored = new Map();
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === 'expo-constants') return { default: {} };
    if (name === 'expo-secure-store') return {};
    throw new Error('Unexpected import: ' + name);
  }, Headers, FormData, Response, URL, fetch, __DEV__: false, process: { env: { EXPO_PUBLIC_API_URL: 'http://test-api' } }, window: { sessionStorage: { setItem: (key, value) => stored.set(key, value), getItem: key => stored.get(key), removeItem: key => stored.delete(key) } } });
  return { ...module.exports, stored };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('public authentication never sends the previous account bearer', async () => {
  const client = loadClient(async (url, init) => { assert.equal(init.headers.get('Authorization'), null); return json({ customer: { id: 2 }, access: 'new', refresh: 'new-r' }); });
  await client.setSession({ access: 'expired', refresh: 'old-r' });
  await client.api.login({ email: 'new@example.com', password: 'password123' });
  await client.api.register({ email: 'new@example.com', password: 'password123', full_name: 'New', phone: '' });
  await client.api.requestPasswordReset('new@example.com');
});

test('concurrent unauthorized requests share one rotating token renewal', async () => {
  const renewal = deferred(); let refreshes = 0;
  const client = loadClient(async (url, init) => {
    if (url.endsWith('/token/refresh/')) { refreshes++; return renewal.promise; }
    if (init.headers.get('Authorization') === 'Bearer expired') return json({ detail: 'expired' }, 401);
    assert.equal(init.headers.get('Authorization'), 'Bearer renewed'); return json({ id: 1 });
  });
  await client.setSession({ access: 'expired', refresh: 'r1' });
  const a = client.api.me(), b = client.api.listOrders();
  await nextTurn();
  assert.equal(refreshes, 1);
  renewal.resolve(json({ access: 'renewed', refresh: 'r2' }));
  await Promise.all([a, b]);
  assert.equal(client.stored.get('medifind.refresh'), 'r2');
  assert.equal(client.hasSession(), true);
});

test('late private responses cannot commit after an account switch', async () => {
  const response = deferred();
  const client = loadClient(() => response.promise);
  await client.setSession({ access: 'a', refresh: 'ra' });
  const oldRequest = client.api.me();
  await client.setSession({ access: 'b', refresh: 'rb' });
  response.resolve(json({ id: 1 }));
  await assert.rejects(oldRequest, /account changed/);
  assert.equal(client.stored.get('medifind.refresh'), 'rb');
});

test('a late renewal cannot overwrite or clear the next account session', async () => {
  const renewal = deferred();
  const client = loadClient(async url => url.endsWith('/token/refresh/') ? renewal.promise : json({ detail: 'expired' }, 401));
  await client.setSession({ access: 'a', refresh: 'ra' });
  const oldRequest = client.api.me(); await nextTurn();
  await client.setSession({ access: 'b', refresh: 'rb' });
  renewal.resolve(json({ access: 'stale-renewed', refresh: 'stale-refresh' }));
  await assert.rejects(oldRequest);
  assert.equal(client.stored.get('medifind.refresh'), 'rb');
  assert.equal(client.hasSession(), true);
});

test('temporary renewal network failures retain the session for retry', async () => {
  const client = loadClient(async url => { if (url.endsWith('/token/refresh/')) throw new Error('offline'); return json({ detail: 'expired' }, 401); });
  await client.setSession({ access: 'a', refresh: 'ra' });
  await assert.rejects(client.api.me(), /reconnect/);
  assert.equal(client.hasSession(), true);
  assert.equal(client.stored.get('medifind.refresh'), 'ra');
});

test('a permanently rejected refresh clears tokens and notifies profile listeners once', async () => {
  const client = loadClient(async () => json({ detail: 'expired' }, 401));
  let cleared = 0; client.onSessionCleared(() => { cleared++; });
  await client.setSession({ access: 'a', refresh: 'ra' });
  await assert.rejects(client.api.me());
  assert.equal(cleared, 1);
  assert.equal(client.hasSession(), false);
  assert.equal(client.stored.has('medifind.refresh'), false);
});
