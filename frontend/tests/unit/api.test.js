import { test } from 'node:test';
import assert from 'node:assert/strict';

test('envoie la session et le CSRF sans exposer le token dans le body', async () => {
  globalThis.window = { dispatchEvent() {} };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const { apiRequest, setCsrfToken } = await import('../../src/app/api.js');
  setCsrfToken('csrf-test');
  await apiRequest('profile.php', { method: 'PATCH', body: { name: 'Awa' } });
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers['X-CSRF-Token'], 'csrf-test');
  assert.deepEqual(JSON.parse(calls[0].options.body), { name: 'Awa' });
});
