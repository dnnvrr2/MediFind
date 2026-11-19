import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseSavedCart } from '../src/domain/cart.ts';

const source = readFileSync(new URL('../src/state/cart-storage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function storage(platform, stubs) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, window: stubs.window,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === 'expo-file-system') return { File: stubs.File, Paths: { document: 'test' } };
      if (name === '../domain/cart') return { parseSavedCart };
      throw new Error('Unexpected import: ' + name);
    },
  });
  return module.exports;
}

const savedItems = [{
  medicineId: 'unlisted-medicine', pharmacyId: 'test-pharmacy', quantity: 3,
  prescriptionId: 'RX-0001', revision: 2,
  snapshot: { name: 'Test medicine', strength: '100 mg', form: 'Tablet' },
}];

test('web cart restores items per account and remembers a cleared cart', () => {
  const disk = new Map();
  const window = { localStorage: {
    getItem: key => disk.get(key) ?? null,
    setItem: (key, data) => disk.set(key, data),
  } };
  const firstRun = storage('web', { window });
  const account = firstRun.savedCartKey('1');
  const otherAccount = firstRun.savedCartKey('2');
  firstRun.saveCart(account, savedItems);

  const afterReload = storage('web', { window });
  assert.deepEqual(afterReload.readSavedCart(account), savedItems);
  assert.deepEqual([...afterReload.readSavedCart(otherAccount)], []);
  afterReload.saveCart(account, []);
  assert.deepEqual(firstRun.readSavedCart(account), []);
});

test('native cart keeps the last saved items if committing a new file fails', () => {
  const disk = new Map();
  let interruptCommit = false;
  class File {
    constructor(_folder, name) { this.name = name; }
    get exists() { return disk.has(this.name); }
    textSync() { return disk.get(this.name); }
    write(data) { disk.set(this.name, data); }
    delete() { disk.delete(this.name); }
    rename(name) {
      if (interruptCommit && this.name.endsWith('.pending')) throw new Error('Commit interrupted');
      disk.set(name, this.textSync());
      this.delete();
      this.name = name;
    }
  }
  const firstRun = storage('android', { File });
  const key = firstRun.savedCartKey('1');
  firstRun.saveCart(key, savedItems);
  interruptCommit = true;
  assert.throws(() => firstRun.saveCart(key, []), /commit interrupted/i);

  interruptCommit = false;
  const afterRestart = storage('android', { File });
  assert.deepEqual(afterRestart.readSavedCart(key), savedItems);
  afterRestart.saveCart(key, []);
  assert.deepEqual(afterRestart.readSavedCart(key), []);
});
