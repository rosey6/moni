import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker() {
  const handlers = {}, shown = [], opened = [];
  const fetched = [], cached = [];
  const self = {
    location: { origin: 'https://moni.example.test' },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  };
  const caches = { match: async () => null, open: async () => ({ put: async request => cached.push(request) }) };
  const fetch = request => { fetched.push(request); return Promise.resolve({ ok: true, clone() { return this; } }); };
  vm.runInNewContext(readFileSync(new URL('../../sw.js', import.meta.url), 'utf8'), { self, URL, Set, caches, fetch });
  return { handlers, shown, opened, self, fetched, cached };
}

test('push neutre et destination contrôlée même avec un payload sensible', async () => {
  const { handlers, shown, opened } = worker();
  let task;
  handlers.push({ data: { json: () => ({ route: 'https://evil.test/', amount: 12345, message: 'secret' }) }, waitUntil: value => { task = value; } });
  await task;
  assert.equal(shown[0].title, 'Moni');
  assert.equal(shown[0].options.body, 'Tu as une nouvelle notification.');
  assert.equal(shown[0].options.data.route, 'dashboard');
  assert.ok(!JSON.stringify(shown).includes('12345'));
  handlers.notificationclick({ notification: { data: { route: '//evil.test/' }, close() {} }, waitUntil: value => { task = value; } });
  await task;
  assert.deepEqual(opened, ['https://moni.example.test/index.html#dashboard']);
});

test('un clic réutilise seulement une fenêtre Moni de même origine', async () => {
  const { handlers, self } = worker();
  let destination, focused = false, task;
  self.clients.matchAll = async () => [
    { url: 'https://evil.test/index.html' },
    { url: 'https://moni.example.test/other' },
    { url: 'https://moni.example.test/index.html', navigate: async url => { destination = url; return { focus: async () => { focused = true; } }; } },
  ];
  handlers.notificationclick({ notification: { data: { route: 'budgets' }, close() {} }, waitUntil: value => { task = value; } });
  await task;
  assert.equal(destination, 'https://moni.example.test/index.html#budgets');
  assert.equal(focused, true);
});

test('le push neutre peut ouvrir le centre de notifications', async () => {
  const { handlers, shown, opened } = worker();
  let task;
  handlers.push({ data: { json: () => ({ route: 'notifications', amount: 999 }) }, waitUntil: value => { task = value; } });
  await task;
  assert.equal(shown[0].options.data.route, 'notifications');
  handlers.notificationclick({ notification: { data: shown[0].options.data, close() {} }, waitUntil: value => { task = value; } });
  await task;
  assert.deepEqual(opened, ['https://moni.example.test/index.html#notifications']);
});

test('le service worker ne met pas en cache les API privées', () => {
  const { handlers } = worker();
  for (const url of ['https://moni.example.test/backend/me.php', 'https://api.example.test/notifications.php']) {
    let intercepted = false;
    handlers.fetch({ request: { url, method: 'GET' }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});

test('le service worker ne met pas en cache les URLs à jeton', async () => {
  const { handlers, fetched, cached } = worker();
  const request = { url: 'https://moni.example.test/index.html?token=private', method: 'GET' };
  let response;
  handlers.fetch({ request, respondWith(value) { response = value; } });
  await response;
  assert.deepEqual(fetched, [request]);
  assert.deepEqual(cached, []);
});

test('les politiques CSP Nginx restent fermées aux scripts inline et aux origines externes', () => {
  for (const file of ['../../../deployment/nginx/moni.conf', '../../../deployment/nginx/moni-validation.conf.example', '../../../deployment/contabo/nginx.conf']) {
    const config = readFileSync(new URL(file, import.meta.url), 'utf8');
    const match = config.match(/add_header Content-Security-Policy "([^"]+)" always;/);
    assert.ok(match, `CSP missing in ${file}`);
    for (const directive of ["default-src 'self'", "connect-src 'self'", "style-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "base-uri 'self'"]) assert.ok(match[1].includes(directive), `${directive} missing in ${file}`);
    assert.doesNotMatch(match[1], /unsafe-inline|unsafe-eval|https?:\/\//);
  }
});

test('chaque ressource précachée existe dans le frontend', () => {
  const script = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
  const list = script.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
  assert.ok(list, 'PRECACHE_URLS absent');
  const urls = Array.from(list[1].matchAll(/'([^']+)'/g), match => match[1]);
  for (const url of urls) {
    const pathname = url.split('?')[0];
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    assert.ok(existsSync(new URL('../../' + relativePath, import.meta.url)), 'Ressource introuvable : ' + url);
  }
});
