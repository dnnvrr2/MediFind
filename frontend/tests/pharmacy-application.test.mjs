import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationErrors, documentKinds } from '../src/domain/pharmacy-application.ts';
const complete = { name: 'Branch', applicant: 'Owner', email: 'branch@example.com', address: 'Carmen, CDO', phone: '09123456789', hours: '8 AM - 5 PM' };
test('a draft can save core details before contact hours are finished', () => {
  const draft = { ...complete, phone: '', hours: '' };
  assert.deepEqual(applicationErrors(draft, false), {});
  assert.deepEqual(Object.keys(applicationErrors(draft, true)), ['phone', 'hours']);
});
test('submission validates branch contact and documents are distinct requirements', () => {
  assert.deepEqual(applicationErrors(complete), {});
  assert.ok(applicationErrors({ ...complete, email: 'invalid' }).email);
  assert.ok(applicationErrors({ ...complete, phone: '123' }).phone);
  assert.deepEqual(documentKinds, ['FDA', 'Business', 'Pharmacist']);
});
