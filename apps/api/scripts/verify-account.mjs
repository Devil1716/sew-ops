// Sew Ops change-password check. Creates a TEST manager (clean up with the SQL from the instructions).
const BASE = process.env.API_BASE ?? 'http://localhost:4000/v1';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

function makeJar() {
  const cookies = {};
  return {
    set(res) {
      for (const line of res.headers.getSetCookie()) {
        const pair = line.split(';')[0];
        const i = pair.indexOf('=');
        cookies[pair.slice(0, i).trim()] = pair.slice(i + 1);
      }
    },
    header() {
      return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

async function call(jar, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: jar.header() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar.set(res);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function must(res, label) {
  if (res.status >= 300) throw new Error(`${label} failed: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '   (' + detail + ')' : ''}`);
  if (!ok) failed += 1;
}

async function main() {
  const RUN = (Math.random().toString(36).slice(2) + '00000000').slice(0, 8).toLowerCase();
  const admin = makeJar();
  const sessionA = makeJar();
  const sessionB = makeJar();
  const anon = makeJar();
  const email = `test.mgr.${RUN}@example.com`;
  const OLD = 'Test-Manager-123456';
  const NEW = 'Test-Manager-654321';

  must(await call(admin, 'POST', '/auth/login', { email: EMAIL, password: PASSWORD }), 'admin login');
  const factory = must(await call(admin, 'GET', '/factories'), 'factories')[0];
  must(await call(admin, 'POST', '/users', { role: 'manager', name: 'Test Manager', email, password: OLD, factoryIds: [factory.id] }), 'create manager');
  must(await call(sessionA, 'POST', '/auth/login', { email, password: OLD }), 'login A');
  must(await call(sessionB, 'POST', '/auth/login', { email, password: OLD }), 'login B');

  // The endpoint allows 5 calls a minute per address, so the sequence below is counted carefully.
  const unauth = await call(anon, 'POST', '/account/password', { currentPassword: OLD, newPassword: NEW });
  check('1: needs a login', unauth.status === 401);

  const wrong = await call(sessionA, 'POST', '/account/password', { currentPassword: 'definitely-wrong-123', newPassword: NEW });
  check('2: a wrong current password is refused', wrong.status === 400 && /current password/i.test(JSON.stringify(wrong.data)));

  const short = await call(sessionA, 'POST', '/account/password', { currentPassword: OLD, newPassword: 'short1' });
  check('3: a new password under 12 characters is refused', short.status === 400);

  const same = await call(sessionA, 'POST', '/account/password', { currentPassword: OLD, newPassword: OLD });
  check('4: reusing the current password is refused', same.status === 400);

  const ok = await call(sessionA, 'POST', '/account/password', { currentPassword: OLD, newPassword: NEW });
  check('5: the change succeeds', ok.status === 200 && ok.data?.ok === true);

  check('6: this session stays signed in', (await call(sessionA, 'GET', '/auth/me')).status === 200);
  check('7: the other device is signed out', (await call(sessionB, 'GET', '/auth/me')).status === 401);
  check('8: the old password no longer works', (await call(makeJar(), 'POST', '/auth/login', { email, password: OLD })).status === 401);
  check('9: the new password works', (await call(makeJar(), 'POST', '/auth/login', { email, password: NEW })).status === 200);

  const sixth = await call(sessionA, 'POST', '/account/password', { currentPassword: NEW, newPassword: 'Another-Password-9999' });
  check('10: a 6th try within a minute is rate limited', sixth.status === 429, `status=${sixth.status}`);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('\nClean up the test data with the SQL from the instructions.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});