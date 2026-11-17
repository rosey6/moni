import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const base = __ENV.MONI_K6_BASE || 'https://localhost:18453/backend';
if (base !== 'https://localhost:18453/backend' || __ENV.MONI_K6_DB !== 'moni_validation_vps') {
  throw new Error('k6 scope guard: local isolated API and database confirmation required');
}
const appErrors = new Rate('app_errors');
const rateLimited = new Counter('expected_rate_limited');
const loginLatency = new Trend('login_latency', true);
const readLatency = new Trend('read_latency', true);
const writeLatency = new Trend('write_latency', true);
export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  insecureSkipTLSVerify: true,
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)'],
  thresholds: {
    app_errors: ['rate<0.01'],
    login_latency: ['p(95)<2000'],
    read_latency: ['p(95)<1000'],
    write_latency: ['p(95)<1500'],
  },
};
let sessionInitialized = false;
let csrfToken;
let sessionCookie;
let sessionCookieName;

export function setup() {
  const count = options.vus;
  const accounts = [];
  for (let i = 0; i < count; i++) {
    const email = `k6-${Date.now()}-${i}@example.test`;
    const password = 'K6-Isolated-Validation-2026!';
    const res = http.post(`${base}/register.php`, JSON.stringify({ name: `k6 fictif ${i}`, email, password, currency: 'XOF', privacyAccepted: true, privacyPolicyVersion: 'test-v1' }), { headers: { 'Content-Type': 'application/json' } });
    if (res.status !== 201) fail(`fixture signup failed (${res.status})`);
    accounts.push({ email, password });
  }
  return accounts;
}

function request(method, path, body, csrf, group) {
  const res = http.request(method, `${base}/${path}`, body === undefined ? null : JSON.stringify(body), { headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(sessionCookie ? { Cookie: `${sessionCookieName}=${sessionCookie}` } : {}) } });
  if (group === 'login') loginLatency.add(res.timings.duration);
  if (group === 'read') readLatency.add(res.timings.duration);
  if (group === 'write') writeLatency.add(res.timings.duration);
  if (res.status === 429) rateLimited.add(1);
  else appErrors.add(res.status < 200 || res.status >= 400);
  return res;
}

export default function (accounts) {
  const account = accounts[__VU - 1];
  if (!account) fail('missing dedicated fictitious account');
  if (!sessionInitialized) {
    const login = request('POST', 'login.php', { email: account.email, password: account.password }, undefined, 'login');
    if (login.status === 429) return;
    if (!check(login, { 'login succeeds': r => r.status === 200 })) return;
    csrfToken = login.json('data.csrfToken');
    sessionCookieName = Object.keys(login.cookies || {})[0];
    sessionCookie = sessionCookieName ? login.cookies[sessionCookieName]?.[0]?.value : undefined;
    if (!sessionCookie) fail('login did not return a session cookie');
    sessionInitialized = true;
  }
  for (const path of ['dashboard.php', 'transactions.php', 'budgets.php', 'savings.php', 'notifications.php']) {
    const response = request('GET', path, undefined, undefined, 'read');
    check(response, { [`${path} read succeeds`]: r => r.status === 200 });
  }
  const tx = request('POST', 'transactions.php', { type: 'income', amount: 1, category: 'salary', date: '2026-11-13', description: `k6-${__VU}-${__ITER}` }, csrfToken, 'write');
  if (check(tx, { 'transaction insert succeeds': r => r.status === 201 })) {
    const id = tx.json('data.state.transactions.0.id');
    if (id) request('DELETE', `transactions.php?id=${id}`, { id }, csrfToken, 'write');
  }
  const goal = request('POST', 'savings.php', { name: `k6-${__VU}-${__ITER}`, mode: 'goal', target: 2, date: null }, csrfToken, 'write');
  if (check(goal, { 'goal insert succeeds': r => r.status === 201 })) {
    const goals = goal.json('data.state.goals');
    const created = goals?.find(item => item.name === `k6-${__VU}-${__ITER}`);
    if (created) request('DELETE', `savings.php?id=${created.id}`, { id: created.id }, csrfToken, 'write');
  }
  sleep(1);
}
