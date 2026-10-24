// Sew Ops security probes against the running API. Read-only: creates no data.
import http from 'node:http';
import https from 'node:https';

const BASE = process.env.API_BASE ?? 'http://localhost:4000/v1';
const ORIGIN = new URL(BASE).origin;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '   (' + detail + ')' : ''}`);
  if (!ok) failed += 1;
}

async function call(method, url, { body, headers = {} } = {}) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, headers: res.headers, text, data };
}
const api = (method, path, opts) => call(method, BASE + path, opts);
const jsonOpts = (obj, headers = {}) => ({ body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json', ...headers } });

// fetch may refuse to send an Origin header, so CORS probes use the plain http module.
function rawHttp(method, urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method, headers }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
  });
}

const ZERO = '00000000-0000-4000-8000-000000000000';
const LEAK = /node_modules|[\\/]src[\\/]|at\s+\S+\s+\(|"stack"|prisma|SELECT\s|Unique constraint|ECONNREFUSED/i;

async function main() {
  console.log('--- A: anonymous callers are turned away ---');
  const GETS = ['/auth/me', '/factories', '/lines', '/machines', '/shifts', '/users', '/operator-assignments', '/work-orders', '/issues', '/downtime', '/dashboard/kpis', '/dashboard/lines', '/dashboard/trend', '/dashboard/downtime', '/quality/checks', '/notifications', '/reports/production?from=2026-01-01&to=2026-01-02', '/audit-logs', '/settings'];
  const badGets = [];
  for (const p of GETS) {
    const r = await api('GET', p);
    if (r.status !== 401) badGets.push(`${p} -> ${r.status}`);
  }
  check(`A: all ${GETS.length} protected GET routes answer 401 without a login`, badGets.length === 0, badGets.join('; '));

  const POSTS = ['/production/events', '/issues', '/quality/checks', '/users', '/lines', '/machines', '/shifts', '/work-orders', '/operator-assignments', '/account/password', '/notifications/read-all', `/machines/${ZERO}/maintenance`, `/issues/${ZERO}/resolve`];
  const badPosts = [];
  for (const p of POSTS) {
    const r = await api('POST', p, jsonOpts({}));
    if (r.status !== 401) badPosts.push(`${p} -> ${r.status}`);
  }
  check(`A: all ${POSTS.length} protected POST routes answer 401 without a login`, badPosts.length === 0, badPosts.join('; '));

  const health = await call('GET', `${ORIGIN}/health`);
  check('A: the health page says nothing beyond up/down', health.status === 200 && Object.keys(health.data ?? {}).sort().join(',') === 'database,service,status,time');
  check('A: login with an empty body is a clean 400', (await api('POST', '/auth/login', jsonOpts({}))).status === 400);

  console.log('\n--- B: forged credentials ---');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: ZERO, role: 'admin' })}.`;
  check('B: a garbage login cookie is refused', (await api('GET', '/auth/me', { headers: { Cookie: 'sewops_at=garbage' } })).status === 401);
  check('B: an unsigned ("alg none") admin token is refused', (await api('GET', '/users', { headers: { Cookie: `sewops_at=${unsigned}` } })).status === 401);
  check('B: a refresh cookie alone opens nothing', (await api('GET', '/users', { headers: { Cookie: 'sewops_rt=abcdef0123456789' } })).status === 401);

  console.log('\n--- C: cookies ---');
  const login = await api('POST', '/auth/login', jsonOpts({ email: EMAIL, password: PASSWORD }));
  if (login.status !== 200) throw new Error(`admin login failed: HTTP ${login.status} (is the password right? is the login rate-limited right now? wait a minute)`);
  const cookies = login.headers.getSetCookie();
  const at = cookies.find((c) => c.startsWith('sewops_at='));
  const rt = cookies.find((c) => c.startsWith('sewops_rt='));
  check('C: a login sets both cookies', !!at && !!rt);
  check('C: both are HttpOnly (scripts on the page cannot read them)', cookies.length >= 2 && cookies.every((c) => /;\s*httponly/i.test(c)));
  check('C: both carry a SameSite rule', cookies.every((c) => /;\s*samesite=(lax|strict)/i.test(c)));
  check('C: the refresh cookie is only sent to the sign-in routes', !!rt && /;\s*path=\/v1\/auth/i.test(rt));
  check('C: no token appears in the login response body', !/token|jwt|eyJ/i.test(JSON.stringify(login.data)));
  const secure = cookies.every((c) => /;\s*secure/i.test(c));
  console.log(`INFO  Secure flag on cookies: ${secure ? 'yes' : 'no (fine on http://localhost; MUST be yes in production, verified at deployment)'}`);
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

  console.log('\n--- D: response headers ---');
  const sample = await api('GET', '/auth/me');
  const wanted = [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'no-referrer'], ['cache-control', 'no-store']];
  const missingHeaders = wanted.filter(([n, v]) => sample.headers.get(n) !== v).map(([n]) => n);
  check('D: anti-sniffing, anti-framing, referrer and no-cache headers are set', missingHeaders.length === 0, missingHeaders.join(', '));
  check('D: a content security policy is set', /default-src 'none'/.test(sample.headers.get('content-security-policy') ?? ''));
  check('D: the server does not announce its framework', !sample.headers.get('x-powered-by'));
  check('D: every response carries a request id', !!sample.headers.get('x-request-id'));
  const echoed = await api('GET', '/auth/me', { headers: { 'X-Request-Id': 'sec-test-12345678' } });
  check('D: a well-formed request id is echoed back', echoed.headers.get('x-request-id') === 'sec-test-12345678');
  const replaced = await api('GET', '/auth/me', { headers: { 'X-Request-Id': 'bad id <script>' } });
  check('D: a malformed request id is replaced, never reflected', /^[0-9a-f-]{36}$/.test(replaced.headers.get('x-request-id') ?? ''));

  console.log('\n--- E: which websites may call the API ---');
  const evil = await rawHttp('OPTIONS', `${BASE}/machines`, { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' });
  const evilAllow = evil.headers['access-control-allow-origin'];
  check('E: a stranger website is not allowed', evilAllow !== 'https://evil.example' && evilAllow !== '*', `allow-origin=${evilAllow ?? 'none'}`);
  const good = await rawHttp('OPTIONS', `${BASE}/machines`, { Origin: WEB_ORIGIN, 'Access-Control-Request-Method': 'GET' });
  check('E: our own website is allowed, with cookies', good.headers['access-control-allow-origin'] === WEB_ORIGIN && good.headers['access-control-allow-credentials'] === 'true', `allow-origin=${good.headers['access-control-allow-origin'] ?? 'none'}`);

  console.log('\n--- F: bad input never becomes a crash or a leak ---');
  const badJson = await api('POST', '/auth/login', { body: '{bad json', headers: { 'Content-Type': 'application/json' } });
  check('F: malformed JSON is a clean 400', badJson.status === 400, `status=${badJson.status}`);
  const huge = await api('POST', '/auth/login', jsonOpts({ email: 'a@b.co', password: 'x'.repeat(1_500_000) }));
  check('F: a 1.5 MB body is refused, not processed', huge.status === 413 || huge.status === 400, `status=${huge.status}`);
  const nowhere = await api('GET', '/this/route/does/not/exist');
  check('F: an unknown address is a clean 404', nowhere.status === 404);
  const inj1 = await api('GET', '/issues?limit=1;DROP%20TABLE%20users', { headers: { Cookie: cookieHeader } });
  const inj2 = await api('GET', "/machines?lineId=%27%20OR%201%3D1--", { headers: { Cookie: cookieHeader } });
  const inj3 = await api('GET', "/audit-logs?before=2026-01-01%27%3B%20--", { headers: { Cookie: cookieHeader } });
  check('F: injection-style input in query strings is refused with 400', inj1.status === 400 && inj2.status === 400 && inj3.status === 400, `${inj1.status}/${inj2.status}/${inj3.status}`);
  check('F: the system is still healthy afterwards', (await api('GET', '/auth/me', { headers: { Cookie: cookieHeader } })).status === 200);
  const leaky = [['401', sample], ['bad json', badJson], ['404', nowhere], ['injection', inj1], ['body limit', huge]].filter(([, r]) => LEAK.test(r.text)).map(([n]) => n);
  check('F: error messages never reveal code, paths, SQL or stack traces', leaky.length === 0, leaky.join(', '));

  console.log('\n--- G: password guessing is slowed down ---');
  let limited = 0;
  let serverErrors = 0;
  for (let i = 0; i < 40 && !limited; i += 1) {
    const r = await api('POST', '/auth/login', jsonOpts({ email: `nobody.${Date.now()}.${i}@example.com`, password: 'wrong-password-123' }));
    if (r.status === 429) limited = i + 1;
    if (r.status >= 500) serverErrors += 1;
  }
  check('G: repeated bad logins hit a rate limit (429)', limited > 0, limited ? `after ${limited} attempts` : 'never limited in 40 attempts');
  check('G: guessing never causes a server error', serverErrors === 0);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('Note: logins from this computer stay rate-limited for about a minute after this test.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});