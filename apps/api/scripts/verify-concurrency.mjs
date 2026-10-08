// Sew Ops integrity + concurrency check. Creates TEST-* data (clean up with the SQL printed at the end).
const BASE = process.env.API_BASE ?? 'http://localhost:4000/v1';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

const range = (n) => Array.from({ length: n }, (_, i) => i);

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
const statuses = (rs) => [...new Set(rs.map((r) => r.status))].join(',');
const createdCount = (rs) => rs.filter((r) => r.status === 200 && r.data?.duplicate === false).length;

async function main() {
  const RUN = Math.random().toString(36).slice(2, 6).toUpperCase();
  const admin = makeJar();
  const op = makeJar();

  must(await call(admin, 'POST', '/auth/login', { email: EMAIL, password: PASSWORD }), 'admin login');
  const factory = must(await call(admin, 'GET', '/factories'), 'factories')[0];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: factory.timezone }).format(new Date());

  console.log(`Setting up test data (run ${RUN})...`);
  const line = must(await call(admin, 'POST', '/lines', { factoryId: factory.id, name: 'Test Line', code: `TEST-L-${RUN}`, targetPerShift: 100 }), 'line');
  const machineCode = `TEST-M-${RUN}`;
  const machine = must(await call(admin, 'POST', '/machines', { lineId: line.id, name: 'Test Machine', code: machineCode }), 'machine');
  const shift = must(await call(admin, 'POST', '/shifts', { factoryId: factory.id, name: `TEST AllDay ${RUN}`, startsAt: '00:00', endsAt: '23:59' }), 'shift');
  const user = must(await call(admin, 'POST', '/users', { role: 'operator', name: 'Test Operator', employeeCode: `TEST-OP-${RUN}`, pin: '493817', factoryIds: [factory.id] }), 'operator');
  must(await call(admin, 'POST', '/operator-assignments', { userId: user.id, machineId: machine.id, shiftId: shift.id, startDate: today }), 'assignment');
  const wo = must(await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber: `TEST-PO-${RUN}`, styleCode: 'P', garment: 'Polo', quantityTarget: 1000, plannedStart: '2026-10-01T00:00:00.000Z' }), 'work order');
  must(await call(admin, 'POST', `/work-orders/${wo.id}/assignments`, { lineId: line.id }), 'wo assignment');
  must(await call(admin, 'PATCH', `/work-orders/${wo.id}`, { status: 'active' }), 'activate wo');
  must(await call(op, 'POST', '/auth/operator-login', { machineCode, pin: '493817' }), 'operator login');

  const counter = async () => must(await call(admin, 'GET', `/work-orders/${wo.id}`), 'wo').quantityCompleted;
  const machineStatus = async () => must(await call(admin, 'GET', `/machines?lineId=${line.id}`), 'machines')[0].status;

  console.log('\n--- Piece Completed ---');
  const keyA = `raceA-${RUN}`;
  const resA = await Promise.all(range(10).map(() => call(op, 'POST', '/production/events', { idempotencyKey: keyA, quantity: 1 })));
  check('A: 10 identical taps all answered 200', resA.every((r) => r.status === 200), `statuses: ${statuses(resA)}`);
  check('A: exactly 1 created, 9 duplicates', createdCount(resA) === 1, `created=${createdCount(resA)}`);
  check('A: counter is 1', (await counter()) === 1, `counter=${await counter()}`);

  const resB = await Promise.all(range(10).map((i) => call(op, 'POST', '/production/events', { idempotencyKey: `raceB${i}-${RUN}`, quantity: 1 })));
  check('B: 10 different taps all answered 200', resB.every((r) => r.status === 200), `statuses: ${statuses(resB)}`);
  check('B: all 10 created (no lost updates)', createdCount(resB) === 10, `created=${createdCount(resB)}`);
  check('B: counter is 11', (await counter()) === 11, `counter=${await counter()}`);

  const resC = await Promise.all(range(10).map(() => call(op, 'POST', '/production/events/undo', { idempotencyKey: keyA })));
  check('C: 10 simultaneous undos all answered 200', resC.every((r) => r.status === 200), `statuses: ${statuses(resC)}`);
  check('C: undone exactly once', createdCount(resC) === 1, `reversed=${createdCount(resC)}`);
  check('C: counter is 10', (await counter()) === 10, `counter=${await counter()}`);

  console.log('\n--- Issues ---');
  const keyD = `issD-${RUN}`;
  const resD = await Promise.all(range(10).map(() => call(op, 'POST', '/issues', { type: 'other', idempotencyKey: keyD })));
  check('D: 10 identical issue reports all answered 200', resD.every((r) => r.status === 200), `statuses: ${statuses(resD)}`);
  check('D: exactly 1 issue created', createdCount(resD) === 1, `created=${createdCount(resD)}`);

  const resE = await Promise.all(range(10).map((i) => call(op, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `issE${i}-${RUN}` })));
  check('E: 10 different keys, same type: all answered 200', resE.every((r) => r.status === 200), `statuses: ${statuses(resE)}`);
  check('E: only 1 open thread issue created', createdCount(resE) === 1, `created=${createdCount(resE)}`);

  const open = must(await call(op, 'GET', '/operator/issues'), 'operator issues');
  check('F: operator sees exactly 2 open issues', Array.isArray(open) && open.length === 2, `count=${open.length}`);
  check('F: machine status is idle', (await machineStatus()) === 'idle', `status=${await machineStatus()}`);

  const otherId = resD.find((r) => r.data?.duplicate === false).data.issue.id;
  const threadId = resE.find((r) => r.data?.duplicate === false).data.issue.id;
  const resG = await Promise.all(range(10).map(() => call(admin, 'POST', `/issues/${otherId}/resolve`, {})));
  check('G: 10 simultaneous resolves all answered 200', resG.every((r) => r.status === 200), `statuses: ${statuses(resG)}`);
  check('G: resolved exactly once', createdCount(resG) === 1, `resolved=${createdCount(resG)}`);
  must(await call(admin, 'POST', `/issues/${threadId}/resolve`, {}), 'resolve thread');
  const openAfter = must(await call(op, 'GET', '/operator/issues'), 'operator issues');
  check('G: no open issues left', openAfter.length === 0, `count=${openAfter.length}`);
  check('G: machine back to running', (await machineStatus()) === 'running', `status=${await machineStatus()}`);

  console.log('\n--- Integrity ---');
  const events = must(await call(admin, 'GET', `/production/events?workOrderId=${wo.id}&limit=200`), 'events');
  const net = events.reduce((s, e) => s + e.quantity, 0);
  check('H: 12 events recorded (11 taps + 1 reversal)', events.length === 12, `events=${events.length}`);
  check('H: net sum of events equals work order counter', net === (await counter()), `sum=${net}, counter=${await counter()}`);

  const downtime = must(await call(admin, 'GET', `/downtime?machineId=${machine.id}`), 'downtime');
  check('I: exactly 2 downtime records', downtime.length === 2, `rows=${downtime.length}`);
  check('I: none still ongoing', downtime.every((d) => d.ongoing === false), `ongoing=${downtime.filter((d) => d.ongoing).length}`);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('\nClean up the test data with the SQL from the instructions.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});