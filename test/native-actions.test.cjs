const test = require('node:test');
const assert = require('node:assert/strict');
const { PosterlyActions } = require('../dist/nodes/PosterlyActions/PosterlyActions.node');

function context(inputs, replies, continueOnFail = false) {
  const requests = [];
  return {
    requests,
    getInputData: () => inputs.map(() => ({ json: {} })),
    getNodeParameter: (name, index, fallback) => inputs[index][name] ?? fallback,
    getNode: () => ({ name: 'posterly Actions', type: 'posterlyActions', typeVersion: 1, parameters: {}, position: [0, 0] }),
    continueOnFail: () => continueOnFail,
    helpers: { httpRequestWithAuthentication: async (_credential, request) => {
      requests.push(request);
      if (!replies.length) throw new Error('Unexpected request');
      return replies.shift();
    } },
  };
}

test('native fields, fixed selectors and structured results preserve input pairing', async () => {
  const ctx = context([
    { operation: 'list_accounts_learned_voice', inputs: { account_id: '1' } },
    { operation: 'list_accounts_performance_profile', inputs: { account_id: '2' } },
  ], [
    { result: { content: [{ text: 'Voice' }], structuredContent: { data: { learned_voice: { tone: 'friendly' } } } } },
    { result: { content: [{ text: 'Profile' }], structuredContent: { data: { profile: { score: 80 } } } } },
  ]);
  const [rows] = await PosterlyActions.prototype.execute.call(ctx);
  assert.deepEqual(ctx.requests.map(r => r.body.params.arguments.view), ['learned_voice', 'performance_profile']);
  assert.ok(ctx.requests.every(r => r.body.method === 'posterly/native-call'));
  assert.deepEqual(rows.map(r => r.pairedItem.item), [0, 1]);
  assert.equal(rows[0].json.data.learned_voice.tone, 'friendly');
});

test('bad parameters and missing write approval fail before HTTP', async () => {
  const ctx = context([{ operation: 'manage_comment_update', inputs: { comment_id: 'comment', is_read: true } }], []);
  await assert.rejects(PosterlyActions.prototype.execute.call(ctx), /Approve/);
  assert.equal(ctx.requests.length, 0);
});

test('continue-on-fail retains an item error and processes the next input', async () => {
  const ctx = context([
    { operation: 'get_post_post', inputs: { post_id: 0 } },
    { operation: 'get_post_post', inputs: { post_id: 1 } },
  ], [{ result: { content: [{ text: 'Post' }], structuredContent: { data: { post: { id: 1 } } } } }], true);
  const [rows] = await PosterlyActions.prototype.execute.call(ctx);
  assert.match(rows[0].json.error, /at least 1/);
  assert.equal(rows[1].json.data.post.id, 1);
  assert.equal(ctx.requests.length, 1);
});

test('preview IDs stay mappable and an HTTP 200 tool failure is not success', async () => {
  const ctx = context([{ operation: 'manage_comment_reply', inputs: { comment_id: 'comment', content: 'Reply' } }], [{ result: { content: [{ text: 'Preview' }], structuredContent: { preview_id: 'signed-preview', requires_confirmation: true } } }]);
  const [rows] = await PosterlyActions.prototype.execute.call(ctx);
  assert.equal(rows[0].json.preview_id, 'signed-preview');
  assert.equal(ctx.requests[0].body.params.arguments.confirm, undefined);
  const denied = context([{ operation: 'get_post_post', inputs: { post_id: 1 } }], [{ result: { isError: true, content: [{ text: 'No workspace permission' }] } }]);
  await assert.rejects(PosterlyActions.prototype.execute.call(denied), /No workspace permission/);
});
