// Sew Ops audit-log + settings check. Creates TEST-* data (clean up with the SQL from the instructions).
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
  const RUN = (Math.random().toString(36).slice(2) + '00000000').slice(0, 8).toUpperCase();
  const admin = makeJar();
  const mgr = makeJar();
  const op = makeJar();

  must(await call(admin, 'POST', '/auth/login', { email: EMAIL, password: PASSWORD }), 'admin login');
  const factory = must(await call(admin, 'GET', '/factories'), 'factories')[0];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: factory.timezone }).format(new Date());
  const fq = `?factoryId=${factory.id}`;

  console.log(`Setting up test data (run ${RUN})...`);
  const line = must(await call(admin, 'POST', '/lines', { factoryId: factory.id, name: 'Test Line', code: `TEST-L-${RUN}`, targetPerShift: 100 }), 'line');
  const machineCode = `TEST-M-${RUN}`;
  const m1 = must(await call(admin, 'POST', '/machines', { lineId: line.id, name: 'Test Machine 1', code: machineCode }), 'machine');
  const shift = must(await call(admin, 'POST', '/shifts', { factoryId: factory.id, name: `TEST AllDay ${RUN}`, startsAt: '00:00', endsAt: '23:59' }), 'shift');
  const user = must(await call(admin, 'POST', '/users', { role: 'operator', name: 'Test Operator', employeeCode: `TEST-OP-${RUN}`, pin: '493817', factoryIds: [factory.id] }), 'operator');
  const mgrEmail = `test.mgr.${RUN.toLowerCase()}@example.com`;
  must(await call(admin, 'POST', '/users', { role: 'manager', name: 'Test Manager', email: mgrEmail, password: 'Test-Manager-123456', factoryIds: [factory.id] }), 'manager');
  must(await call(admin, 'POST', '/operator-assignments', { userId: user.id, machineId: m1.id, shiftId: shift.id, startDate: today }), 'assignment');
  const wo = must(await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber: `TEST-PO-${RUN}`, styleCode: 'P', garment: 'Polo', quantityTarget: 100, plannedStart: '2026-10-01T00:00:00.000Z' }), 'work order');
  must(await call(admin, 'POST', `/work-orders/${wo.id}/assignments`, { lineId: line.id }), 'wo assignment');
  must(await call(admin, 'PATCH', `/work-orders/${wo.id}`, { status: 'active' }), 'activate wo');
  must(await call(op, 'POST', '/auth/operator-login', { machineCode, pin: '493817' }), 'operator login');
  must(await call(mgr, 'POST', '/auth/login', { email: mgrEmail, password: 'Test-Manager-123456' }), 'manager login');

  const unread = async (jar) => must(await call(jar, 'GET', '/notifications'), 'notifications').unreadCount;
  const rules = async () => must(await call(admin, 'GET', `/settings${fq}`), 'settings').alertRules;

  console.log('\n--- Settings: access ---');
  check('A: a manager cannot read settings', (await call(mgr, 'GET', '/settings')).status === 403);
  check('A: an operator cannot read settings', (await call(op, 'GET', '/settings')).status === 403);
  check('A: settings need a login', (await call(makeJar(), 'GET', '/settings')).status === 401);
  check('A: a manager cannot change settings', (await call(mgr, 'PATCH', '/settings/alert-rules', { rules: { thread_empty: false } })).status === 403);

  console.log('\n--- Settings: alert rules ---');
  must(await call(admin, 'PATCH', '/settings/alert-rules', { factoryId: factory.id, rules: { machine_issue: true, thread_empty: true, material_missing: true, quality_issue: true, other: true } }), 'reset rules');
  const r0 = await rules();
  check('B: every alert type can be on', Object.keys(r0).length === 5 && Object.values(r0).every((v) => v === true));

  must(await call(admin, 'PATCH', '/settings/alert-rules', { factoryId: factory.id, rules: { thread_empty: false } }), 'turn thread off');
  const r1 = await rules();
  check('B: turning one off changes only that one', r1.thread_empty === false && r1.machine_issue === true && r1.other === true);

  const thread = must(await call(op, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `thr-${RUN}` }), 'thread issue');
  check('C: a switched-off type does not alert', (await unread(mgr)) === 0);
  const mach = must(await call(op, 'POST', '/issues', { type: 'machine_issue', idempotencyKey: `mach-${RUN}` }), 'machine issue');
  check('C: other types still alert', (await unread(mgr)) === 1);

  must(await call(admin, 'PATCH', '/settings/alert-rules', { factoryId: factory.id, rules: { thread_empty: true } }), 'turn thread on');
  must(await call(mgr, 'POST', `/issues/${thread.issue.id}/resolve`, {}), 'resolve thread');
  must(await call(op, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `thr2-${RUN}` }), 'thread issue again');
  check('C: switching it back on alerts again', (await unread(mgr)) === 2);
  must(await call(mgr, 'POST', `/issues/${mach.issue.id}/resolve`, {}), 'cleanup machine issue');

  const bad1 = await call(admin, 'PATCH', '/settings/alert-rules', { factoryId: factory.id, rules: { foo: true } });
  const bad2 = await call(admin, 'PATCH', '/settings/alert-rules', { factoryId: factory.id, rules: {} });
  const bad3 = await call(admin, 'PATCH', '/settings/alert-rules', { factoryId: factory.id, rules: { other: 'yes' } });
  check('D: an unknown alert type is refused', bad1.status === 400);
  check('D: an empty change is refused', bad2.status === 400);
  check('D: a non-boolean value is refused', bad3.status === 400);

  console.log('\n--- Audit log ---');
  check('E: a manager cannot read the audit log', (await call(mgr, 'GET', '/audit-logs')).status === 403);
  check('E: an operator cannot read the audit log', (await call(op, 'GET', '/audit-logs')).status === 403);
  check('E: the audit log needs a login', (await call(makeJar(), 'GET', '/audit-logs')).status === 401);

  const page = must(await call(admin, 'GET', `/audit-logs${fq}&limit=5`), 'audit');
  check('F: the limit is respected, newest first', page.items.length === 5 && page.items.every((e, i) => i === 0 || e.createdAt <= page.items[i - 1].createdAt));
  check('F: each entry says when, what and to whom', page.items.every((e) => e.createdAt && e.action && e.entityType));

  const settingsLog = must(await call(admin, 'GET', `/audit-logs${fq}&category=settings&limit=10`), 'audit settings');
  const latest = settingsLog.items[0];
  check('G: settings changes are recorded with before and after', !!latest && latest.action === 'settings.alert_rules_updated' && latest.before?.thread_empty === false && latest.after?.thread_empty === true);
  check('G: the entry names who did it', latest?.actorName === 'Dhanush R Poojari' && latest?.actorRole === 'admin');

  const users = must(await call(admin, 'GET', `/audit-logs${fq}&category=user&limit=50`), 'audit users');
  check('H: the category filter only returns that category', users.items.length > 0 && users.items.every((e) => e.action.startsWith('user.')));
  const issues = must(await call(admin, 'GET', `/audit-logs${fq}&category=issue&limit=50`), 'audit issues');
  check('H: issue activity is recorded', issues.items.some((e) => e.action === 'issue.opened') && issues.items.every((e) => e.action.startsWith('issue.')));

  const p1 = must(await call(admin, 'GET', `/audit-logs${fq}&limit=3`), 'page 1');
  const p2 = must(await call(admin, 'GET', `/audit-logs${fq}&limit=3&before=${encodeURIComponent(p1.nextBefore)}`), 'page 2');
  const ids1 = new Set(p1.items.map((e) => e.id));
  check('I: paging gives a cursor', p1.items.length === 3 && !!p1.nextBefore);
  check('I: the next page is older and does not repeat', p2.items.length > 0 && p2.items.every((e) => !ids1.has(e.id) && e.createdAt <= p1.nextBefore));

  const future = new Date(Date.now() + 86_400_000).toISOString();
  const none = must(await call(admin, 'GET', `/audit-logs${fq}&from=${encodeURIComponent(future)}`), 'future');
  check('J: a date filter in the future returns nothing', none.items.length === 0 && none.nextBefore === null);

  check('K: an unknown category is refused', (await call(admin, 'GET', '/audit-logs?category=nope')).status === 400);
  check('K: a bad date is refused', (await call(admin, 'GET', '/audit-logs?before=yesterday')).status === 400);
  check('K: an oversized limit is refused', (await call(admin, 'GET', '/audit-logs?limit=500')).status === 400);

  const everything = must(await call(admin, 'GET', `/audit-logs${fq}&limit=200`), 'bulk');
  const dump = JSON.stringify(everything.items).toLowerCase();
  check('L: no secrets appear in the log', !dump.includes('passwordhash') && !dump.includes('pinhash') && !dump.includes('"pin"') && !dump.includes('"password"') && !dump.includes('argon2'));

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('\nClean up the test data with the SQL from the instructions.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});