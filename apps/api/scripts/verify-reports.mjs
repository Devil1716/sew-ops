// Sew Ops quality + reports check. Creates TEST-* data (clean up with the SQL from the instructions).
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

async function raw(jar, path) {
  const res = await fetch(BASE + path, { headers: { Cookie: jar.header() } });
  return {
    status: res.status,
    text: await res.text(),
    type: res.headers.get('content-type') ?? '',
    disposition: res.headers.get('content-disposition') ?? '',
  };
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
const created = (rs) => rs.filter((r) => r.status === 200 && r.data?.duplicate === false).length;

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
  const machine = must(await call(admin, 'POST', '/machines', { lineId: line.id, name: 'Test Machine', code: machineCode }), 'machine');
  const shift = must(await call(admin, 'POST', '/shifts', { factoryId: factory.id, name: `TEST AllDay ${RUN}`, startsAt: '00:00', endsAt: '23:59' }), 'shift');
  const user = must(await call(admin, 'POST', '/users', { role: 'operator', name: 'Test Operator', employeeCode: `TEST-OP-${RUN}`, pin: '493817', factoryIds: [factory.id] }), 'operator');
  const mgrEmail = `test.mgr.${RUN.toLowerCase()}@example.com`;
  must(await call(admin, 'POST', '/users', { role: 'manager', name: 'Test Manager', email: mgrEmail, password: 'Test-Manager-123456', factoryIds: [factory.id] }), 'manager');
  must(await call(admin, 'POST', '/operator-assignments', { userId: user.id, machineId: machine.id, shiftId: shift.id, startDate: today }), 'assignment');
  const orderNumber = `TEST-PO-${RUN}`;
  const wo = must(await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber, styleCode: 'P', garment: 'Polo', quantityTarget: 1000, plannedStart: '2026-10-01T00:00:00.000Z' }), 'work order');
  must(await call(admin, 'POST', `/work-orders/${wo.id}/assignments`, { lineId: line.id }), 'wo assignment');
  must(await call(admin, 'PATCH', `/work-orders/${wo.id}`, { status: 'active' }), 'activate wo');
  must(await call(op, 'POST', '/auth/operator-login', { machineCode, pin: '493817' }), 'operator login');
  must(await call(mgr, 'POST', '/auth/login', { email: mgrEmail, password: 'Test-Manager-123456' }), 'manager login');

  // 5 taps, 1 undo => net 4 pieces. One machine issue and one break => 2 downtime rows.
  const tapKeys = range(5).map((i) => `tap${i}-${RUN}`);
  for (const k of tapKeys) must(await call(op, 'POST', '/production/events', { idempotencyKey: k, quantity: 1 }), 'tap');
  must(await call(op, 'POST', '/production/events/undo', { idempotencyKey: tapKeys[0] }), 'undo');
  const mi = must(await call(op, 'POST', '/issues', { type: 'machine_issue', idempotencyKey: `mi-${RUN}` }), 'issue');
  must(await call(admin, 'POST', `/issues/${mi.issue.id}/resolve`, {}), 'resolve issue');
  const br = must(await call(op, 'POST', '/issues', { type: 'break_pause', idempotencyKey: `br-${RUN}` }), 'break');
  must(await call(op, 'POST', `/issues/${br.issue.id}/resolve`, {}), 'end break');

  console.log('\n--- Quality checks ---');
  const q1 = await call(mgr, 'POST', '/quality/checks', { workOrderId: wo.id, machineId: machine.id, inspectedQty: 50, rejectedQty: 3, defectType: 'broken_stitch', idempotencyKey: `q1-${RUN}` });
  check('A: manager records a check', q1.status === 200 && q1.data.duplicate === false && q1.data.check.rejectedQty === 3);

  const keyQ2 = `q2-${RUN}`;
  const q2s = await Promise.all(range(10).map(() => call(mgr, 'POST', '/quality/checks', { workOrderId: wo.id, inspectedQty: 0, rejectedQty: 2, defectType: 'open_seam', idempotencyKey: keyQ2 })));
  check('B: 10 simultaneous identical submissions all answered 200', q2s.every((r) => r.status === 200), [...new Set(q2s.map((r) => r.status))].join(','));
  check('B: exactly one check created', created(q2s) === 1, `created=${created(q2s)}`);

  const q3 = must(await call(mgr, 'POST', '/quality/checks', { workOrderId: wo.id, inspectedQty: 20, rejectedQty: 1, defectType: 'stain', idempotencyKey: `q3-${RUN}` }), 'q3');
  const v1 = await call(mgr, 'POST', `/quality/checks/${q3.check.id}/void`);
  const v2 = await call(mgr, 'POST', `/quality/checks/${q3.check.id}/void`);
  check('C: a check can be voided', v1.status === 200 && v1.data.duplicate === false && v1.data.check.voided === true);
  check('C: voiding twice is harmless', v2.status === 200 && v2.data.duplicate === true);

  const listed = must(await call(mgr, 'GET', `/quality/checks?workOrderId=${wo.id}`), 'list');
  const listedAll = must(await call(mgr, 'GET', `/quality/checks?workOrderId=${wo.id}&includeVoided=true`), 'list all');
  check('D: voided checks are hidden by default', listed.length === 2, `visible=${listed.length}`);
  check('D: includeVoided shows all 3', listedAll.length === 3, `all=${listedAll.length}`);

  const base = { workOrderId: wo.id };
  const bad1 = await call(mgr, 'POST', '/quality/checks', { ...base, inspectedQty: 10, rejectedQty: 11, defectType: 'stain', idempotencyKey: `b1-${RUN}` });
  const bad2 = await call(mgr, 'POST', '/quality/checks', { ...base, inspectedQty: 10, rejectedQty: 2, idempotencyKey: `b2-${RUN}` });
  const bad3 = await call(mgr, 'POST', '/quality/checks', { ...base, inspectedQty: 10, rejectedQty: 2, defectType: 'on_fire', idempotencyKey: `b3-${RUN}` });
  const bad4 = await call(mgr, 'POST', '/quality/checks', { ...base, inspectedQty: 0, rejectedQty: 0, idempotencyKey: `b4-${RUN}` });
  const bad5 = await call(mgr, 'POST', '/quality/checks', { ...base, inspectedQty: 10, rejectedQty: 0, defectType: 'stain', idempotencyKey: `b5-${RUN}` });
  const bad6 = await call(mgr, 'POST', '/quality/checks', { ...base, inspectedQty: 10, rejectedQty: 0, idempotencyKey: `b6-${RUN}`, status: 'hacked' });
  check('E: rejected > inspected is refused', bad1.status === 400);
  check('E: rejects without a defect type are refused', bad2.status === 400);
  check('E: unknown defect type is refused', bad3.status === 400);
  check('E: an empty check is refused', bad4.status === 400);
  check('E: a defect type without rejects is refused', bad5.status === 400);
  check('E: unknown fields are refused', bad6.status === 400);

  const opTry = await call(op, 'POST', '/quality/checks', { ...base, inspectedQty: 10, rejectedQty: 0, idempotencyKey: `op-${RUN}` });
  check('F: an operator cannot record quality checks', opTry.status === 403);

  const woC = must(await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber: `TEST-PO-C-${RUN}`, styleCode: 'C', garment: 'Cancelled', quantityTarget: 10, plannedStart: '2026-10-01T00:00:00.000Z' }), 'woC');
  must(await call(admin, 'PATCH', `/work-orders/${woC.id}`, { status: 'cancelled' }), 'cancel');
  const onCancelled = await call(mgr, 'POST', '/quality/checks', { workOrderId: woC.id, inspectedQty: 5, rejectedQty: 0, idempotencyKey: `c-${RUN}` });
  check('G: a cancelled work order is refused', onCancelled.status === 400);

  const badOrder = await call(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber: '=1+1', styleCode: 'X', garment: 'X', quantityTarget: 1, plannedStart: '2026-10-01T00:00:00.000Z' });
  check('G: order numbers starting with = are refused', badOrder.status === 400);

  console.log('\n--- Production report ---');
  const prod = must(await call(mgr, 'GET', '/reports/production'), 'production report');
  check('H: default range is today in the factory timezone', prod.from === today && prod.to === today, `${prod.from}..${prod.to}`);
  check('H: net pieces are 4 (5 taps minus 1 undo)', prod.totals.pieces === 4, `pieces=${prod.totals.pieces}`);
  const mine = prod.rows.find((r) => r.machineCode === machineCode);
  check('H: the row names the right line, machine and order', !!mine && mine.lineCode === line.code && mine.orderNumber === orderNumber && mine.day === today);
  check('H: totals by line add up', prod.byLine.find((l) => l.lineCode === line.code)?.pieces === 4);

  const prodCsv = await raw(mgr, '/reports/production');
  check('I: json is the default format', prodCsv.type.includes('application/json'));
  const csv = await raw(mgr, '/reports/production?format=csv');
  const lines = csv.text.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
  check('I: csv has the right headers and content type', csv.status === 200 && csv.type.includes('text/csv') && lines[0] === 'day,line,machine,work_order,pieces', lines[0]);
  check('I: csv is a download with a dated filename', csv.disposition.includes('attachment') && csv.disposition.includes(`production_${today}_${today}.csv`));
  check('I: csv contains the data row', lines.some((l) => l.includes(machineCode) && l.endsWith(',4')));

  const old = must(await call(mgr, 'GET', '/reports/production?from=2026-01-01&to=2026-01-02'), 'old range');
  check('J: an empty range returns zero pieces', old.totals.pieces === 0 && old.rows.length === 0);

  console.log('\n--- Downtime report ---');
  const dt = must(await call(mgr, 'GET', '/reports/downtime'), 'downtime report');
  const dtMachine = dt.rows.filter((r) => r.machineCode === machineCode);
  const dtIssue = dtMachine.find((r) => r.reason === 'machine_issue');
  const dtBreak = dtMachine.find((r) => r.reason === 'break_pause');
  check('K: the machine breakdown is unplanned', !!dtIssue && dtIssue.planned === false && dtIssue.events === 1);
  check('K: the break is planned', !!dtBreak && dtBreak.planned === true && dtBreak.events === 1);
  check('K: minutes are numbers, not negative', dtMachine.every((r) => typeof r.minutes === 'number' && r.minutes >= 0));
  const dtCsv = await raw(mgr, '/reports/downtime?format=csv');
  check('K: downtime csv works', dtCsv.status === 200 && dtCsv.text.replace(/^\uFEFF/, '').startsWith('line,machine,reason,planned,events,minutes'));

  console.log('\n--- Quality report ---');
  const qr = must(await call(mgr, 'GET', '/reports/quality'), 'quality report');
  check('L: voided checks are excluded from totals', qr.totals.inspected === 50 && qr.totals.rejected === 5, `inspected=${qr.totals.inspected}, rejected=${qr.totals.rejected}`);
  check('L: reject rate is 10%', qr.totals.rejectRatePct === 10, `rate=${qr.totals.rejectRatePct}`);
  const bs = qr.byDefect.find((d) => d.defectType === 'broken_stitch');
  const os = qr.byDefect.find((d) => d.defectType === 'open_seam');
  check('L: defects are broken down correctly', bs?.rejected === 3 && os?.rejected === 2 && !qr.byDefect.some((d) => d.defectType === 'stain'));
  const qcsv = await raw(mgr, '/reports/quality?format=csv');
  check('L: quality csv works', qcsv.status === 200 && qcsv.text.replace(/^\uFEFF/, '').startsWith('day,work_order,defect_type,inspected,rejected'));

  console.log('\n--- Report rules ---');
  const r1 = await call(mgr, 'GET', '/reports/production?from=2026-10-09&to=2026-10-01');
  const r2 = await call(mgr, 'GET', '/reports/production?from=2026-01-01&to=2026-12-31');
  const r3 = await call(mgr, 'GET', '/reports/production?from=2026-13-45');
  const r4 = await call(mgr, 'GET', '/reports/production?format=xml');
  check('M: from after to is refused', r1.status === 400);
  check('M: a range over 92 days is refused', r2.status === 400);
  check('M: an impossible date is refused', r3.status === 400);
  check('M: an unknown format is refused', r4.status === 400);
  const opReport = await call(op, 'GET', '/reports/production');
  check('N: an operator cannot read reports', opReport.status === 403);
  const noLogin = await call(makeJar(), 'GET', '/reports/production');
  check('N: reports need a login', noLogin.status === 401);

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
  console.log('\nClean up the test data with the SQL from the instructions.');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});