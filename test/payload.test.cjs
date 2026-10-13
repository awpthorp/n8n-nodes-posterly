const test = require('node:test');
const assert = require('node:assert/strict');
const { approvedPost, postPayload, scheduleDate } = require('../dist/nodes/Posterly/payload');
const input = { accountId: '123', caption: 'Test', scheduledAt: '2030-01-01T10:00:00Z', settingsJson: '{}' };
test('write refuses missing approval, date, or idempotency key', () => {
  assert.throws(() => approvedPost(input), /Approve/);
  assert.throws(() => approvedPost({ ...input, confirm: true }), /idempotency/);
  assert.throws(() => approvedPost({ ...input, confirm: true, idempotencyKey: '1', scheduledAt: '' }), /future/);
});
test('past and timezone-less dates are rejected', () => {
  assert.throws(() => scheduleDate('2000-01-01T00:00:00Z'));
  assert.throws(() => scheduleDate('2030-01-01T10:00:00'));
});
test('settings cannot overwrite the account, date, or approval boundary', () => {
  const result = postPayload({ ...input, settingsJson: '{"account_id":"other","dry_run":false}' });
  assert.equal(result.account_id, '123');
  assert.equal(result.scheduled_at, '2030-01-01T10:00:00.000Z');
  assert.equal(result.dry_run, undefined);
});

test('non-object platform settings are refused', () => {
  for (const settingsJson of ['null', 'false', '0', '[]', '\"text\"']) assert.throws(() => postPayload({ ...input, settingsJson }), /JSON object/);
});
