const test = require('node:test');
const assert = require('node:assert/strict');
const { Posterly } = require('../dist/nodes/Posterly/Posterly.node');

function context(parameters, replies) {
  const requests = [];
  return {
    requests,
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _index, fallback) => parameters[name] ?? fallback,
    getNode: () => ({ name: 'posterly', type: 'posterly', typeVersion: 1, parameters, position: [0, 0] }),
    continueOnFail: () => false,
    helpers: { httpRequestWithAuthentication: async function (credential, request) {
      assert.equal(credential, 'posterlyApi');
      requests.push(request);
      if (!replies.length) throw new Error('Unexpected network request');
      return replies.shift();
    } },
  };
}

test('list posts follows server cursors and retains workspace and input pairing', async () => {
  const ctx = context({ operation: 'listPosts', workspaceId: 'workspace-1', status: 'published', returnAll: true }, [
    { posts: [{ id: '1' }], has_more: true, next_offset: 1 },
    { posts: [{ id: '2' }], has_more: false, next_offset: null },
  ]);
  const [result] = await Posterly.prototype.execute.call(ctx);
  assert.deepEqual(result.map(row => row.json.id), ['1', '2']);
  assert.deepEqual(ctx.requests.map(request => request.qs.offset), [0, 1]);
  assert.ok(ctx.requests.every(request => request.qs.workspace_id === 'workspace-1' && request.qs.status === 'published'));
  assert.ok(result.every(row => row.pairedItem.item === 0));
});

test('a repeated cursor fails instead of making endless requests', async () => {
  const ctx = context({ operation: 'listPosts', returnAll: true }, [{ posts: [{ id: '1' }], has_more: true, next_offset: 0 }]);
  await assert.rejects(Posterly.prototype.execute.call(ctx), /pagination cursor/);
  assert.equal(ctx.requests.length, 1);
});

test('schedule guards run before HTTP and retries preserve the source key', async () => {
  const parameters = { operation: 'schedulePost', accountId: '123', caption: 'Test', scheduledAt: '2030-01-01T10:00:00Z', idempotencyKey: 'record-1', confirm: false };
  const blocked = context(parameters, []);
  await assert.rejects(Posterly.prototype.execute.call(blocked), /Approve/);
  assert.equal(blocked.requests.length, 0);
  const approved = context({ ...parameters, confirm: true }, [{ post: { id: 'post-1' } }]);
  const [result] = await Posterly.prototype.execute.call(approved);
  assert.equal(result[0].json.id, 'post-1');
  assert.equal(approved.requests[0].headers['Idempotency-Key'], 'record-1');
  assert.equal(approved.requests[0].body.scheduled_at, '2030-01-01T10:00:00.000Z');
});

test('validate uses a dry run and omits a write retry header', async () => {
  const ctx = context({ operation: 'validatePost', accountId: '123', caption: 'Test', scheduledAt: '2030-01-01T10:00:00Z' }, [{ valid: true }]);
  const [result] = await Posterly.prototype.execute.call(ctx);
  assert.equal(result[0].json.valid, true);
  assert.equal(ctx.requests[0].body.dry_run, true);
  assert.equal(ctx.requests[0].headers['Idempotency-Key'], undefined);
});
