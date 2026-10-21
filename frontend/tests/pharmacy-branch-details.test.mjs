import test from 'node:test';
import assert from 'node:assert/strict';
import { contactError, contactsError, canonicalContact } from '../src/domain/pharmacy-contacts.ts';
import { defaultSchedule, scheduleError, scheduleSummary, timeLabel } from '../src/domain/pharmacy-schedule.ts';

test('mobile prefixes have the correct digit counts with explicit short and long warnings', () => {
  for (const value of ['09123456789', '+639123456789', '+63 912 345 6789', '0912-345-6789']) assert.equal(contactError(value), '', value);
  assert.match(contactError('0912345678'), /Too few.*8\/9/);
  assert.match(contactError('091234567890'), /Too many.*10\/9/);
  assert.match(contactError('+63912345678'), /Too few.*9\/10/);
  assert.match(contactError('+6391234567890'), /Too many.*11\/10/);
  assert.match(contactError('+638123456789'), /start with 9/);
  assert.match(contactError('0912a456789'), /digits only/);
  assert.match(contactError('9123456789'), /Start/);
});
test('additional contacts validate every number and reject duplicate formats', () => {
  assert.equal(contactsError(['09123456789', '+639987654321']), '');
  assert.match(contactsError(['09123456789', '+639123456789']), /duplicate/);
  assert.match(contactsError(['09123456789', '09123']), /Too few/);
  assert.match(contactsError(['09123456789', '']), /Enter/);
  assert.equal(contactsError([''], false), '');
  assert.equal(canonicalContact('0912 345 6789'), '+639123456789');
});
test('opening hours summarize days and correctly label noon and midnight', () => {
  assert.equal(scheduleError(defaultSchedule()), '');
  assert.equal(scheduleSummary(defaultSchedule()), 'Mon-Sat: 8:00 AM - 5:00 PM; Sun: Closed');
  assert.equal(timeLabel('00:00'), '12:00 AM');
  assert.equal(timeLabel('12:00'), '12:00 PM');
  assert.equal(scheduleSummary(defaultSchedule().map(row => ({ ...row, open: true, allDay: true }))), 'Every day: 24 hours');
});
test('overnight hours are explicit and invalid schedules are rejected', () => {
  const night = defaultSchedule().map(row => ({ ...row, opens: '22:00', closes: '06:00' }));
  assert.equal(scheduleError(night), '');
  assert.match(scheduleSummary(night), /10:00 PM - 6:00 AM \(\+1 day\)/);
  assert.match(scheduleError(defaultSchedule().map(row => ({ ...row, open: false }))), /opening day/);
  assert.match(scheduleError(defaultSchedule().map(row => ({ ...row, closes: row.opens }))), /different/);
  assert.match(scheduleError(defaultSchedule().map(row => ({ ...row, opens: '25:00' }))), /different/);
});
