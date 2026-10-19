// Sew Ops notifications + maintenance check. Creates TEST-* data (clean up with the SQL from the instructions).
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

  const notes = async (jar, qs = '') => must(await call(jar, 'GET', `/notifications${qs}`), 'notifications');
  const kpis = async () => must(await call(admin, 'GET', `/dashboard/kpis?factoryId=${factory.id}`), 'kpis');
  const machineStatus = async () => must(await call(admin, 'GET', `/machines?lineId=${line.id}`), 'machines')[0].status;
  const adminBase = (await notes(admin)).unreadCount;

  console.log('\n--- Notifications ---');
  check('A: a new manager starts with no alerts', (await notes(mgr)).unreadCount === 0);

  const thread = must(await call(op, 'POST', '/issues', { type: 'thread_empty', note: 'out of white thread', idempotencyKey: `thr-${RUN}` }), 'thread issue');
  let n = await notes(mgr);
  const first = n.items[0];
  check('B: thread empty alerts the manager', n.unreadCount === 1 && n.items.length === 1 && /Thread empty/.test(first.title) && first.title.includes(machineCode));
  check('B: the alert points at the issue and carries the note', first.entityType === 'issue' && first.entityId === thread.issue.id && first.body === 'out of white thread');
  check('B: the admin is alerted too', (await notes(admin)).unreadCount === adminBase + 1);

  const brk = must(await call(op, 'POST', '/issues', { type: 'break_pause', idempotencyKey: `brk-${RUN}` }), 'break');
  check('C: a break does not alert', (await notes(mgr)).unreadCount === 1);
  await call(op, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `thr2-${RUN}` });
  check('C: a repeat report of an open issue does not alert again', (await notes(mgr)).unreadCount === 1);

  const mach = must(await call(op, 'POST', '/issues', { type: 'machine_issue', idempotencyKey: `mach-${RUN}` }), 'machine issue');
  n = await notes(mgr);
  check('D: the second alert arrives, newest first', n.unreadCount === 2 && n.items[0].entityId === mach.issue.id);

  must(await call(mgr, 'POST', `/notifications/${n.items[1].id}/read`), 'mark read');
  check('E: marking one read lowers the count', (await notes(mgr)).unreadCount === 1);
  check('E: marking it again is harmless', (await call(mgr, 'POST', `/notifications/${n.items[1].id}/read`)).status === 200);
  const unreadOnly = await notes(mgr, '?unread=true');
  check('E: the unread filter works', unreadOnly.items.length === 1 && unreadOnly.items.every((i) => i.readAt === null));
  const all = must(await call(mgr, 'POST', '/notifications/read-all'), 'read-all');
  check('E: mark all read', all.updated === 1 && (await notes(mgr)).unreadCount === 0);

  const adminItem = (await notes(admin)).items[0];
  check('F: nobody can touch someone else\'s alert', (await call(mgr, 'POST', `/notifications/${adminItem.id}/read`)).status === 404);
  check('F: an operator cannot read alerts', (await call(op, 'GET', '/notifications')).status === 403);
  check('F: alerts need a login', (await call(makeJar(), 'GET', '/notifications')).status === 401);
  check('F: an operator cannot open a maintenance issue', (await call(op, 'POST', '/issues', { type: 'maintenance', idempotencyKey: `mnt-${RUN}` })).status === 400);

  console.log('\n--- Maintenance ---');
  must(await call(mgr, 'POST', `/issues/${thread.issue.id}/resolve`, {}), 'resolve thread');
  must(await call(mgr, 'POST', `/issues/${mach.issue.id}/resolve`, {}), 'resolve machine issue');
  must(await call(mgr, 'POST', `/issues/${brk.issue.id}/resolve`, {}), 'resolve break');
  check('G: after resolving everything the machine runs', (await machineStatus()) === 'running');
  const stopped0 = (await kpis()).machinesStopped;

  check('G: an operator cannot start maintenance', (await call(op, 'POST', `/machines/${m1.id}/maintenance`, { on: true })).status === 403);
  check('G: a bad request body is refused', (await call(mgr, 'POST', `/machines/${m1.id}/maintenance`, { on: 'yes' })).status === 400);
  check('G: maintenance needs a login', (await call(makeJar(), 'POST', `/machines/${m1.id}/maintenance`, { on: true })).status === 401);

  const start = await call(mgr, 'POST', `/machines/${m1.id}/maintenance`, { on: true, note: 'oil and clean' });
  check('H: a manager starts maintenance', start.status === 200 && start.data.duplicate === false && start.data.machine.status === 'maintenance');
  check('H: the machine list shows maintenance', (await machineStatus()) === 'maintenance');
  check('H: it counts as a stopped machine on the dashboard', (await kpis()).machinesStopped === stopped0 + 1);
  check('H: starting twice is harmless', (await call(mgr, 'POST', `/machines/${m1.id}/maintenance`, { on: true })).data?.duplicate === true);
  const dt = must(await call(admin, 'GET', `/downtime?machineId=${m1.id}`), 'downtime');
  const stops = dt.filter((d) => d.reason === 'maintenance');
  check('H: exactly one ongoing, planned maintenance stop', stops.length === 1 && stops[0].planned === true && stops[0].ongoing === true);

  const tap = await call(op, 'POST', '/production/events', { idempotencyKey: `tap1-${RUN}`, quantity: 1 });
  check('I: pieces are refused during maintenance', tap.status === 409 && /maintenance/i.test(JSON.stringify(tap.data)), `status=${tap.status}`);
  const thr3 = await call(op, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `thr3-${RUN}` });
  check('I: issues can still be reported, status stays maintenance', thr3.status === 200 && (await machineStatus()) === 'maintenance');
  check('I: the manager is alerted', (await notes(mgr)).unreadCount === 1);

  const end = await call(mgr, 'POST', `/machines/${m1.id}/maintenance`, { on: false });
  check('J: ending maintenance returns the machine to idle (an issue is open)', end.status === 200 && end.data.duplicate === false && end.data.machine.status === 'idle', end.data?.machine?.status);
  check('J: ending twice is harmless', (await call(mgr, 'POST', `/machines/${m1.id}/maintenance`, { on: false })).data?.duplicate === true);
  const stop2 = must(await call(admin, 'GET', `/downtime?machineId=${m1.id}`), 'downtime').find((d) => d.reason === 'maintenance');
  check('J: the stop is closed with a duration', !!stop2 && stop2.ongoing === false && stop2.minutes >= 0);

  must(await call(op, 'POST', `/issues/${thr3.data.issue.id}/resolve`, {}), 'operator resolves thread');
  check('K: resolving the last issue returns the machine to running', (await machineStatus()) === 'running');
  check('K: pieces work again', (await call(op, 'POST', '/production/events', { idempotencyKey: `tap2-${RUN}`, quantity: 1 })).status === 200);

  const report = must(await call(admin, 'GET', `/reports/downtime?factoryId=${factory.id}`), 'downtime report');
  const row = report.rows.find((r) => r.machineCode === machineCode && r.reason === 'maintenance');
  check('L: the downtime report lists maintenance as planned', !!row && row.planned === true && row.events === 1);
  check('L: the stopped count is back to where it started', (await kpis()).machinesStopped === stopped0);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('\nClean up the test data with the SQL from the instructions.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});