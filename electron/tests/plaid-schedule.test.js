const assert = require('node:assert/strict');
const test = require('node:test');
const {
  findDueScheduleSlot,
  findNextScheduleSlot,
  scheduleSlotsNear
} = require('../dist/plaid-schedule-settings.js');

const enabled = {
  firstDayEnabled: true,
  lastDayEnabled: true,
  localTime: '09:00'
};

test('calculates leap-year month end in local time', () => {
  const slots = scheduleSlotsNear(new Date(2028, 1, 15, 12), enabled);
  const monthEnd = slots.find(slot => slot.id === 'last:2028-02');
  assert.equal(monthEnd.at.getDate(), 29);
  assert.equal(monthEnd.at.getHours(), 9);
});

test('returns only the latest elapsed slot for catch-up', () => {
  const due = findDueScheduleSlot(new Date(2028, 2, 15, 12), enabled, 'last:2028-01');
  assert.equal(due.id, 'first:2028-03');
});

test('does not return an already completed slot', () => {
  const due = findDueScheduleSlot(new Date(2028, 2, 1, 12), enabled, 'first:2028-03');
  assert.equal(due, null);
});

test('respects independently disabled boundaries', () => {
  const lastOnly = { ...enabled, firstDayEnabled: false };
  const next = findNextScheduleSlot(new Date(2028, 1, 1, 12), lastOnly, 'last:2028-01');
  assert.equal(next.id, 'last:2028-02');
});

test('returns no slot when automatic sync is disabled', () => {
  const disabled = { ...enabled, firstDayEnabled: false, lastDayEnabled: false };
  assert.equal(findNextScheduleSlot(new Date(2028, 1, 1, 12), disabled, null), null);
});
