// Sew Ops dashboard data check. Creates TEST-* data (clean up with the SQL from the instructions).
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
  const get = async (jar, path) => call(jar, 'GET', path);

  console.log(`Setting up test data (run ${RUN})...`);
  const line = must(await call(admin, 'POST', '/lines', { factoryId: factory.id, name: 'Test Line', code: `TEST-L-${RUN}`, targetPerShift: 100 }), 'line');
  const machineCode = `TEST-M-${RUN}`;
  const m1 = must(await call(admin, 'POST', '/machines', { lineId: line.id, name: 'Test Machine 1', code: machineCode }), 'machine 1');
  must(await call(admin, 'POST', '/machines', { lineId: line.id, name: 'Test Machine 2', code: `TEST-N-${RUN}` }), 'machine 2');
  must(await call(admin, 'POST', '/machines', { lineId: line.id, name: 'Test Machine 3', code: `TEST-P-${RUN}` }), 'machine 3');
  const shift = must(await call(admin, 'POST', '/shifts', { factoryId: factory.id, name: `TEST AllDay ${RUN}`, startsAt: '00:00', endsAt: '23:59' }), 'shift');
  const user = must(await call(admin, 'POST', '/users', { role: 'operator', name: 'Test Operator', employeeCode: `TEST-OP-${RUN}`, pin: '493817', factoryIds: [factory.id] }), 'operator');
  const mgrEmail = `test.mgr.${RUN.toLowerCase()}@example.com`;
  must(await call(admin, 'POST', '/users', { role: 'manager', name: 'Test Manager', email: mgrEmail, password: 'Test-Manager-123456', factoryIds: [factory.id] }), 'manager');
  must(await call(admin, 'POST', '/operator-assignments', { userId: user.id, machineId: m1.id, shiftId: shift.id, startDate: today }), 'assignment');
  const orderNumber = `TEST-PO-${RUN}`;
  const wo = must(await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber, styleCode: 'P', garment: 'Polo', quantityTarget: 100, plannedStart: '2026-10-01T00:00:00.000Z' }), 'work order');
  must(await call(admin, 'POST', `/work-orders/${wo.id}/assignments`, { lineId: line.id }), 'wo assignment');
  must(await call(admin, 'PATCH', `/work-orders/${wo.id}`, { status: 'active' }), 'activate wo');
  must(await call(op, 'POST', '/auth/operator-login', { machineCode, pin: '493817' }), 'operator login');
  must(await call(mgr, 'POST', '/auth/login', { email: mgrEmail, password: 'Test-Manager-123456' }), 'manager login');

  const kpis = async () => must(await get(admin, `/dashboard/kpis${fq}`), 'kpis');
  const trendSum = async () => must(await get(admin, `/dashboard/trend${fq}`), 'trend').reduce((s, p) => s + p.completed, 0);

  const base = await kpis();
  const baseTrend = await trendSum();

  console.log('\n--- KPIs ---');
  check('A: kpi fields are all numbers', ['target', 'completed', 'remaining', 'completedToday', 'machinesActive', 'machinesStopped', 'machinesOffline', 'machinesTotal', 'issuesToday'].every((k) => typeof base[k] === 'number'));
  check('A: remaining = target - completed', base.remaining === Math.max(0, base.target - base.completed));

  for (let i = 0; i < 5; i += 1) must(await call(op, 'POST', '/production/events', { idempotencyKey: `tap${i}-${RUN}`, quantity: 1 }), 'tap');
  must(await call(op, 'POST', '/production/events/undo', { idempotencyKey: `tap0-${RUN}` }), 'undo');

  const k1 = await kpis();
  check('B: completed rose by 4 (5 taps - 1 undo)', k1.completed === base.completed + 4, `${base.completed} -> ${k1.completed}`);
  check('B: remaining fell by 4', k1.remaining === base.remaining - 4);
  check('B: completedToday rose by 4', k1.completedToday === base.completedToday + 4);
  check('B: one more machine is running', k1.machinesActive === base.machinesActive + 1);
  check('B: machine totals add up', k1.machinesTotal === k1.machinesActive + k1.machinesStopped + k1.machinesOffline);

  const thread = must(await call(op, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `thr-${RUN}` }), 'issue');
  const k2 = await kpis();
  check('C: the idle machine moves from active to stopped', k2.machinesActive === base.machinesActive && k2.machinesStopped === base.machinesStopped + 1);
  check('C: issuesToday rose by 1', k2.issuesToday === base.issuesToday + 1);

  must(await call(op, 'POST', `/issues/${thread.issue.id}/resolve`, {}), 'resolve');
  const k3 = await kpis();
  check('D: after resolving the machine runs again', k3.machinesActive === base.machinesActive + 1 && k3.machinesStopped === base.machinesStopped);

  console.log('\n--- Lines ---');
  const lines = must(await get(admin, `/dashboard/lines${fq}`), 'lines');
  const mine = lines.find((l) => l.lineId === line.id);
  check('E: the test line is listed', !!mine && mine.lineCode === line.code);
  check('E: it shows the garment, target and net completed', mine?.garment === 'Polo' && mine?.target === 100 && mine?.completed === 4, JSON.stringify(mine && { garment: mine.garment, target: mine.target, completed: mine.completed }));
  check('E: it names the order', mine?.orderNumbers?.includes(orderNumber) === true);

  console.log('\n--- Trend ---');
  const trend = must(await get(admin, `/dashboard/trend${fq}`), 'trend');
  check('F: 24 hourly points by default', trend.length === 24, `points=${trend.length}`);
  check('F: labels look like local hours', trend.every((p) => /^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(p.ts)));
  check('F: the hours are consecutive and in order', trend.every((p, i) => i === 0 || p.ts > trend[i - 1].ts));
  check('F: net pieces in the window rose by 4', (await trendSum()) === baseTrend + 4);
  check('F: the current hour holds the new pieces', trend[trend.length - 1].completed >= 4, `last=${trend[trend.length - 1].completed}`);
  const six = must(await get(admin, `/dashboard/trend${fq}&window=6h`), 'trend 6h');
  check('F: window=6h gives 6 points', six.length === 6);
  check('F: a bad window is refused', (await get(admin, `/dashboard/trend${fq}&window=99999h`)).status === 400 && (await get(admin, `/dashboard/trend${fq}&window=abc`)).status === 400);

  console.log('\n--- Downtime ---');
  const down = must(await get(admin, `/dashboard/downtime${fq}`), 'downtime');
  const thr = down.find((d) => d.reason === 'thread_empty');
  check('G: today\'s thread-empty downtime is listed', !!thr && thr.events >= 1 && typeof thr.minutes === 'number' && thr.minutes >= 0);
  check('G: slices are unplanned unless they are breaks', down.every((d) => d.planned === (d.reason === 'break_pause')));

  console.log('\n--- Access and scoping ---');
  const mk = await get(mgr, '/dashboard/kpis');
  check('H: a manager with one factory needs no factoryId', mk.status === 200 && mk.data.completed === k3.completed);
  const fac2 = must(await call(admin, 'POST', '/factories', { name: 'Test Factory', code: `TEST-F-${RUN}` }), 'second factory');
  const noId = await get(admin, '/dashboard/kpis');
  check('H: an admin with two factories must say which', noId.status === 400);
  const k2f = await get(admin, `/dashboard/kpis?factoryId=${fac2.id}`);
  check('H: another factory starts at zero', k2f.status === 200 && k2f.data.target === 0 && k2f.data.completed === 0 && k2f.data.machinesTotal === 0);
  check('H: a manager cannot read a factory they do not belong to', (await get(mgr, `/dashboard/kpis?factoryId=${fac2.id}`)).status === 404);
  check('H: a bad factory id is refused', (await get(admin, '/dashboard/kpis?factoryId=nope')).status === 400);
  check('H: an operator cannot read the dashboard', (await get(op, '/dashboard/kpis')).status === 403);
  check('H: the dashboard needs a login', (await get(makeJar(), '/dashboard/kpis')).status === 401);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('\nClean up the test data with the SQL from the instructions.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});