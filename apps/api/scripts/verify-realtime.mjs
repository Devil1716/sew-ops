// Sew Ops real-time check. Creates TEST-* data (clean up with the SQL from the instructions).
import { io } from 'socket.io-client';

const BASE = process.env.API_BASE ?? 'http://localhost:4000/v1';
const ORIGIN = process.env.API_ORIGIN ?? new URL(BASE).origin;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

const range = (n) => Array.from({ length: n }, (_, i) => i);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const sockets = [];
function connect(jar, headers = {}) {
  const socket = io(ORIGIN, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    extraHeaders: { ...(jar ? { cookie: jar.header() } : {}), ...headers },
  });
  const state = { socket, inbox: [], disconnected: false };
  socket.onAny((name, payload) => state.inbox.push({ name, payload }));
  socket.on('disconnect', () => { state.disconnected = true; });
  sockets.push(socket);
  return state;
}
const events = (s, name) => s.inbox.filter((e) => e.name === name);
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(25);
  }
  return null;
}

async function main() {
  const RUN = Math.random().toString(36).slice(2, 6).toUpperCase();
  const admin = makeJar();
  const mgr = makeJar();
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
  const mgrEmail = `test.mgr.${RUN.toLowerCase()}@example.com`;
  const mgrUser = must(await call(admin, 'POST', '/users', { role: 'manager', name: 'Test Manager', email: mgrEmail, password: 'Test-Manager-123456', factoryIds: [factory.id] }), 'manager');
  must(await call(admin, 'POST', '/operator-assignments', { userId: user.id, machineId: machine.id, shiftId: shift.id, startDate: today }), 'assignment');
  const wo = must(await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber: `TEST-PO-${RUN}`, styleCode: 'P', garment: 'Polo', quantityTarget: 1000, plannedStart: '2026-10-01T00:00:00.000Z' }), 'work order');
  must(await call(admin, 'POST', `/work-orders/${wo.id}/assignments`, { lineId: line.id }), 'wo assignment');
  must(await call(admin, 'PATCH', `/work-orders/${wo.id}`, { status: 'active' }), 'activate wo');
  must(await call(op, 'POST', '/auth/operator-login', { machineCode, pin: '493817' }), 'operator login');
  must(await call(mgr, 'POST', '/auth/login', { email: mgrEmail, password: 'Test-Manager-123456' }), 'manager login');

  console.log('\n--- Connections and security ---');
  const mgrS = connect(mgr);
  const opS = connect(op);
  const ready = await Promise.all([
    until(() => events(mgrS, 'realtime.ready')[0]),
    until(() => events(opS, 'realtime.ready')[0]),
  ]);
  check('A: manager and operator sockets authenticated', ready.every(Boolean));

  const anon = connect(null);
  await sleep(1200);
  check('B: socket without a login cookie is dropped', anon.disconnected && events(anon, 'realtime.ready').length === 0);

  const evil = connect(mgr, { origin: 'http://evil.example' });
  await sleep(1200);
  check('C: valid cookie from a foreign origin is dropped', evil.disconnected && events(evil, 'realtime.ready').length === 0);

  console.log('\n--- Piece Completed ---');
  const k1 = `rt1-${RUN}`;
  must(await call(op, 'POST', '/production/events', { idempotencyKey: k1, quantity: 1 }), 'tap');
  const piece = await until(() => events(mgrS, 'production.piece_completed')[0]);
  check('D: manager receives piece_completed', !!piece && piece.payload.type === 'piece_completed' && piece.payload.quantityCompleted === 1, piece ? `count=${piece.payload.quantityCompleted}` : 'nothing received');
  const running = await until(() => events(mgrS, 'machine.status_changed').find((e) => e.payload.status === 'running'));
  check('D: manager receives machine status running', !!running);
  const inDb = must(await call(admin, 'GET', `/work-orders/${wo.id}`), 'wo').quantityCompleted;
  check('E: the database already holds the value the event announced', piece && inDb === piece.payload.quantityCompleted, `db=${inDb}`);

  const before = events(mgrS, 'production.piece_completed').length;
  await call(op, 'POST', '/production/events', { idempotencyKey: k1, quantity: 1 });
  await sleep(1200);
  check('F: a duplicate tap broadcasts nothing', events(mgrS, 'production.piece_completed').length === before);

  const raceKey = `rtrace-${RUN}`;
  await Promise.all(range(10).map(() => call(op, 'POST', '/production/events', { idempotencyKey: raceKey, quantity: 1 })));
  await sleep(1500);
  check('G: 10 identical taps broadcast exactly once', events(mgrS, 'production.piece_completed').length === before + 1, `events=${events(mgrS, 'production.piece_completed').length - before}`);

  await call(op, 'POST', '/production/events/undo', { idempotencyKey: raceKey });
  const undo = await until(() => events(mgrS, 'production.piece_completed').find((e) => e.payload.type === 'pieces_undo'));
  check('H: undo is broadcast with a negative quantity', !!undo && undo.payload.quantity === -1 && undo.payload.quantityCompleted === 1);

  console.log('\n--- Issues ---');
  const issueKey = `rtiss-${RUN}`;
  const issue = must(await call(op, 'POST', '/issues', { type: 'machine_issue', note: 'realtime test', idempotencyKey: issueKey }), 'issue');
  const opened = await until(() => events(mgrS, 'issue.opened')[0]);
  check('I: manager receives issue.opened for the right issue and factory', !!opened && opened.payload.id === issue.issue.id && opened.payload.type === 'machine_issue' && opened.payload.factoryId === factory.id);
  const breakdown = await until(() => events(mgrS, 'machine.status_changed').find((e) => e.payload.status === 'breakdown'));
  check('I: manager receives machine status breakdown', !!breakdown);

  await call(op, 'POST', '/issues', { type: 'machine_issue', idempotencyKey: issueKey });
  await sleep(1000);
  check('J: a duplicate issue report broadcasts nothing', events(mgrS, 'issue.opened').length === 1);

  must(await call(mgr, 'PATCH', `/issues/${issue.issue.id}/acknowledge`), 'ack');
  const acked = await until(() => events(mgrS, 'issue.acknowledged')[0]);
  check('K: issue.acknowledged is broadcast', !!acked && acked.payload.status === 'acknowledged');

  must(await call(mgr, 'POST', `/issues/${issue.issue.id}/resolve`, { resolutionNote: 'ok' }), 'resolve');
  const resolved = await until(() => events(mgrS, 'issue.resolved')[0]);
  check('L: issue.resolved is broadcast', !!resolved && resolved.payload.status === 'resolved');
  const backToRunning = await until(() => {
    const all = events(mgrS, 'machine.status_changed');
    return all.length > 0 && all[all.length - 1].payload.status === 'running';
  });
  check('L: the last machine status after resolving is running', !!backToRunning);

  console.log('\n--- Work orders and isolation ---');
  must(await call(admin, 'PATCH', `/work-orders/${wo.id}`, { quantityTarget: 1500 }), 'patch wo');
  const wou = await until(() => events(mgrS, 'work_order.updated').find((e) => e.payload.quantityTarget === 1500));
  check('M: work_order.updated is broadcast', !!wou);

  const leaked = opS.inbox.filter((e) => e.name !== 'realtime.ready');
  check('N: the operator socket received no factory events', leaked.length === 0, `leaked=${leaked.map((e) => e.name).join(',') || 'none'}`);

  console.log('\nDeactivating the manager. Waiting up to 40s for the server to drop their socket...');
  must(await call(admin, 'PATCH', `/users/${mgrUser.id}`, { isActive: false }), 'deactivate');
  const dropped = await until(() => mgrS.disconnected, 40000);
  check('O: a deactivated manager is disconnected', !!dropped);
  const again = connect(mgr);
  await sleep(1500);
  check('P: a deactivated manager cannot reconnect', again.disconnected && events(again, 'realtime.ready').length === 0);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  sockets.forEach((s) => s.disconnect());
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  sockets.forEach((s) => s.disconnect());
  process.exit(1);
});