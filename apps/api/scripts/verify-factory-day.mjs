// Sew Ops simulated factory day. Creates TEST-* data (clean up with the SQL from the instructions).
const BASE = process.env.API_BASE ?? 'http://localhost:4000/v1';
const ORIGIN = new URL(BASE).origin;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  process.exit(1);
}

const OPERATORS = Math.max(6, Math.min(12, Number(process.env.FD_OPERATORS ?? 8)));
const TAPS = Math.max(30, Math.min(200, Number(process.env.FD_TAPS ?? 40)));
const PINS = ['493817', '528164', '716392', '384915', '627481', '159374', '842615', '936248', '271583', '465802', '358296', '614729'];
const LETTERS = 'ABCDEFGH';
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

let rateLimited = 0; // throttled responses outside of logins
async function call(jar, method, path, body, { countLimit = true } = {}) {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: jar.header() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    jar.set(res);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (res.status === 429 && countLimit) rateLimited += 1;
    return { status: res.status, data, headers: res.headers };
  } catch {
    return { status: 0, data: null, headers: new Headers() };
  }
}

function retryAfterMs(res) {
  const s = Number(res.headers.get('retry-after'));
  return Number.isFinite(s) && s > 0 ? Math.min(s, 70) * 1000 + 250 : 5000;
}

async function callRetry(jar, method, path, body) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    last = await call(jar, method, path, body);
    if (last.status === 429) { await sleep(retryAfterMs(last)); continue; }
    if (last.status === 0 || last.status >= 500) { await sleep(300 * attempt); continue; }
    return last;
  }
  return last;
}

async function loginRetry(jar, path, body, label) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const r = await call(jar, 'POST', path, body, { countLimit: false });
    if (r.status === 429) {
      const wait = retryAfterMs(r);
      console.log(`INFO  login rate limit: waiting ${Math.round(wait / 1000)} s before ${label}`);
      await sleep(wait);
      continue;
    }
    if (r.status >= 300) throw new Error(`${label} failed: HTTP ${r.status} ${JSON.stringify(r.data)}`);
    return r.data;
  }
  throw new Error(`${label}: still rate-limited after 6 tries`);
}

function must(res, label) {
  if (!res || res.status >= 300) throw new Error(`${label} failed: HTTP ${res?.status} ${JSON.stringify(res?.data)}`);
  return res.data;
}

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '   (' + detail + ')' : ''}`);
  if (!ok) failed += 1;
}

async function main() {
  const RUN = (Math.random().toString(36).slice(2) + '00000000').slice(0, 8).toUpperCase();
  const startedAt = Date.now();
  const admin = makeJar();
  let maintenanceMachineId = null;
  let socket = null;

  try {
    await loginRetry(admin, '/auth/login', { email: EMAIL, password: PASSWORD }, 'admin login');
    const factory = must(await callRetry(admin, 'GET', '/factories'), 'factories')[0];
    const fq = `factoryId=${factory.id}`;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: factory.timezone }).format(new Date());

    console.log(`Building the factory (run ${RUN}): ${OPERATORS} operators, 2 lines, 3 work orders...`);
    const perLine = Math.floor(OPERATORS / 2);
    const lines = [];
    for (let l = 1; l <= 2; l += 1) {
      const line = must(await callRetry(admin, 'POST', '/lines', { factoryId: factory.id, name: `FD Line ${l}`, code: `TEST-${RUN}-L${l}`, targetPerShift: 500 }), 'line');
      const machines = [];
      for (let m = 0; m < perLine; m += 1) {
        machines.push(must(await callRetry(admin, 'POST', '/machines', { lineId: line.id, name: `FD Machine ${l}${LETTERS[m]}`, code: `TEST-${RUN}-${l}${LETTERS[m]}` }), 'machine'));
      }
      lines.push({ line, machines });
    }
    const shift = must(await callRetry(admin, 'POST', '/shifts', { factoryId: factory.id, name: `TEST AllDay FD ${RUN}`, startsAt: '00:00', endsAt: '23:59' }), 'shift');

    const woSpec = {
      A: { lineId: lines[0].line.id },
      B: { lineId: lines[1].line.id },
      C: { lineId: lines[0].line.id, machineId: lines[0].machines[2].id }, // pinned to ONE machine: must win over the whole-line order
    };
    const orders = {};
    for (const [letter, assignment] of Object.entries(woSpec)) {
      const wo = must(await callRetry(admin, 'POST', '/work-orders', { factoryId: factory.id, orderNumber: `TEST-FD-${RUN}-${letter}`, styleCode: `FD-${letter}`, garment: `Garment ${letter}`, quantityTarget: 100000, plannedStart: '2026-10-01T00:00:00.000Z' }), 'work order');
      must(await callRetry(admin, 'POST', `/work-orders/${wo.id}/assignments`, assignment), 'wo assignment');
      must(await callRetry(admin, 'PATCH', `/work-orders/${wo.id}`, { status: 'active' }), 'activate wo');
      orders[letter] = wo;
    }

    const ops = [];
    for (let i = 0; i < perLine * 2; i += 1) {
      const lineIndex = i < perLine ? 0 : 1;
      const machineIndex = i % perLine;
      const machine = lines[lineIndex].machines[machineIndex];
      const user = must(await callRetry(admin, 'POST', '/users', { role: 'operator', name: `FD Operator ${i + 1}`, employeeCode: `TEST-OP-${RUN}-${i + 1}`, pin: PINS[i], factoryIds: [factory.id] }), 'operator');
      must(await callRetry(admin, 'POST', '/operator-assignments', { userId: user.id, machineId: machine.id, shiftId: shift.id, startDate: today }), 'assignment');
      const wo = lineIndex === 0 ? (machineIndex === 2 ? 'C' : 'A') : 'B';
      ops.push({ idx: i, jar: makeJar(), machine, machineCode: machine.code, wo, pin: PINS[i] });
    }
    for (const op of ops) await loginRetry(op.jar, '/auth/operator-login', { machineCode: op.machineCode, pin: op.pin }, `operator ${op.idx + 1} login`);
    console.log(`Ready: ${ops.length} operators signed in.`);

    const kpi0 = must(await callRetry(admin, 'GET', `/dashboard/kpis?${fq}`), 'kpis').completedToday;

    // Optional: a live manager screen listening during the load.
    const rt = { ready: false, events: 0, disconnects: 0 };
    try {
      const { io } = await import('socket.io-client');
      socket = io(ORIGIN, { extraHeaders: { Cookie: admin.header(), Origin: WEB_ORIGIN }, transports: ['websocket'], reconnection: false });
      socket.on('realtime.ready', () => { rt.ready = true; });
      socket.on('production.piece_completed', () => { rt.events += 1; });
      socket.on('disconnect', () => { rt.disconnects += 1; });
      for (let i = 0; i < 40 && !rt.ready; i += 1) await sleep(100);
    } catch { /* skipped below */ }

    const accepted = new Map();
    const perWo = { A: 0, B: 0, C: 0 };
    const perMachine = new Map();
    const refusedKeys = new Set();
    const unexpected = [];
    let requests = 0;
    let duplicatesSent = 0;
    let replayedFlush = 0;
    let issueSnapshot = null;

    async function sendTap(op, key) {
      const began = Date.now();
      for (let attempt = 1; ; attempt += 1) {
        requests += 1;
        const r = await call(op.jar, 'POST', '/production/events', { idempotencyKey: key, quantity: 1 });
        if (r.status === 200 || r.status === 201) {
          if (!accepted.has(key)) {
            accepted.set(key, op.wo);
            perWo[op.wo] += 1;
            perMachine.set(op.machineCode, (perMachine.get(op.machineCode) ?? 0) + 1);
          }
          return 'ok';
        }
        if (r.status === 409) { refusedKeys.add(key); return 'refused'; }
        if (r.status === 429) await sleep(retryAfterMs(r));
        else if (r.status === 0 || r.status >= 500) await sleep(200 * attempt);
        else { unexpected.push(`${key}: HTTP ${r.status} ${JSON.stringify(r.data)}`); return 'error'; }
        if (Date.now() - began > 120_000) { unexpected.push(`${key}: gave up after 120 s`); return 'error'; }
      }
    }

    // A flaky terminal sometimes sends the same tap twice, at the same moment.
    async function tapWithReplays(op, key) {
      if (Math.random() < 0.2) {
        const copies = 2 + Math.floor(Math.random() * 3);
        duplicatesSent += copies - 1;
        await Promise.all(Array.from({ length: copies }, () => sendTap(op, key)));
      } else {
        await sendTap(op, key);
      }
    }

    async function flush(op, keys) {
      for (let i = 0; i < keys.length; i += 5) await Promise.all(keys.slice(i, i + 5).map((k) => sendTap(op, k)));
      const again = keys.slice(0, 8); // the terminal is unsure the first ones arrived and sends them again
      replayedFlush += again.length;
      await Promise.all(again.map((k) => sendTap(op, k)));
    }

    async function resolveAllFor(machineCode) {
      const list = must(await callRetry(admin, 'GET', '/issues?limit=200'), 'issues');
      const mine = list.filter((i) => i.machineCode === machineCode);
      issueSnapshot = {
        thread: mine.filter((i) => i.type === 'thread_empty').length,
        machine: mine.filter((i) => i.type === 'machine_issue').length,
      };
      for (const i of mine) must(await callRetry(admin, 'POST', `/issues/${i.id}/resolve`, {}), 'resolve issue');
    }

    async function runOperator(op) {
      const offline = op.idx === 1 || op.idx === perLine + 1;
      const queue = [];
      for (let n = 1; n <= TAPS; n += 1) {
        const key = `fd-${RUN}-${op.idx}-${n}`;
        if (op.idx === 0 && n === 10) {
          maintenanceMachineId = op.machine.id;
          must(await callRetry(admin, 'POST', `/machines/${op.machine.id}/maintenance`, { on: true, note: 'factory day test' }), 'maintenance on');
        }
        if (op.idx === 0 && n === 25) {
          must(await callRetry(admin, 'POST', `/machines/${op.machine.id}/maintenance`, { on: false }), 'maintenance off');
          maintenanceMachineId = null;
        }
        if (op.idx === 2 && n === 5) {
          await Promise.all([1, 2, 3].map((j) => callRetry(op.jar, 'POST', '/issues', { type: 'thread_empty', idempotencyKey: `fd-${RUN}-iss-${j}` })));
          await callRetry(op.jar, 'POST', '/issues', { type: 'machine_issue', idempotencyKey: `fd-${RUN}-mach` });
        }
        if (op.idx === 2 && n === 20) await resolveAllFor(op.machineCode);

        if (offline && n > 8 && n <= 28) { queue.push(key); continue; } // the network is down: taps pile up
        if (offline && n === 29) { await sleep(4000); await flush(op, queue); } // the network is back: everything arrives at once
        await tapWithReplays(op, key);
        await sleep(30 + Math.random() * 90);
      }
    }

    console.log(`Simulating the shift: ${ops.length} operators x ${TAPS} pieces, with trouble injected...`);
    const samples = [];
    let polling = true;
    const poller = (async () => {
      while (polling) {
        const r = await call(admin, 'GET', `/dashboard/kpis?${fq}`);
        if (r.status === 200) samples.push(r.data.completedToday - kpi0);
        await sleep(400);
      }
    })();

    const everyone = Promise.all(ops.map((op) => runOperator(op)));
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('the simulated shift did not finish within 6 minutes')), 360_000));
    await Promise.race([everyone, timeout]);
    polling = false;
    await poller;
    await sleep(1500);

    // ---------------- reconciliation ----------------
    console.log('\n--- Reconciliation ---');
    const totalAccepted = accepted.size;
    const refusedForever = [...refusedKeys].filter((k) => !accepted.has(k));
    console.log(`INFO  ${totalAccepted} unique pieces accepted from ${requests} requests (${duplicatesSent} duplicate sends, ${replayedFlush} replays after the offline bursts), in ${Math.round((Date.now() - startedAt) / 1000)} s`);

    check('A: every tap was either accepted or deliberately refused (no unexpected failures)', unexpected.length === 0, unexpected.slice(0, 2).join(' | '));

    const woList = must(await callRetry(admin, 'GET', '/work-orders'), 'work orders');
    for (const letter of ['A', 'B', 'C']) {
      const wo = woList.find((w) => w.orderNumber === `TEST-FD-${RUN}-${letter}`);
      check(`B: work order ${letter} counter equals the pieces accepted for it`, !!wo && wo.quantityCompleted === perWo[letter], `server=${wo?.quantityCompleted} expected=${perWo[letter]}`);
    }

    const machineC = lines[0].machines[2].code;
    const report = must(await callRetry(admin, 'GET', `/reports/production?from=${today}&to=${today}&${fq}`), 'production report');
    const mine = report.rows.filter((r) => r.orderNumber.startsWith(`TEST-FD-${RUN}-`));
    const byOrder = {};
    const byMachine = {};
    for (const r of mine) {
      byOrder[r.orderNumber] = (byOrder[r.orderNumber] ?? 0) + r.pieces;
      byMachine[r.machineCode] = (byMachine[r.machineCode] ?? 0) + r.pieces;
    }
    const orderOk = ['A', 'B', 'C'].every((l) => (byOrder[`TEST-FD-${RUN}-${l}`] ?? 0) === perWo[l]);
    check('C: the production report agrees with each work order', orderOk, JSON.stringify(byOrder));
    const machineOk = ops.every((op) => (byMachine[op.machineCode] ?? 0) === (perMachine.get(op.machineCode) ?? 0));
    check('C: the production report agrees with every machine', machineOk);
    check('D: the machine pinned to its own order never fed the whole-line order', !mine.some((r) => r.machineCode === machineC && r.orderNumber.endsWith('-A')) && perWo.C > 0);

    const kpi1 = must(await callRetry(admin, 'GET', `/dashboard/kpis?${fq}`), 'kpis').completedToday;
    check('E: the dashboard grew by exactly the pieces accepted', kpi1 - kpi0 === totalAccepted, `grew by ${kpi1 - kpi0}, expected ${totalAccepted}`);
    check('E: while the shift ran the dashboard count only ever went up', samples.length > 3 && samples.every((v, i) => i === 0 || v >= samples[i - 1]), `${samples.length} samples`);
    check('E: the dashboard never showed more than could have been sent', samples.every((v) => v <= ops.length * TAPS));

    const serverTotal = ['A', 'B', 'C'].reduce((sum, l) => sum + (woList.find((w) => w.orderNumber === `TEST-FD-${RUN}-${l}`)?.quantityCompleted ?? 0), 0);
    check('F: duplicate sends and replays were collapsed into single pieces', duplicatesSent > 0 && replayedFlush > 0 && serverTotal === totalAccepted && totalAccepted === ops.length * TAPS - refusedForever.length, `server=${serverTotal}, unique=${totalAccepted}, sent=${requests}`);

    check('G: pieces tapped during maintenance were refused and not counted', refusedForever.length === 15, `${refusedForever.length} refused, expected 15`);
    const dt = must(await callRetry(admin, 'GET', `/reports/downtime?from=${today}&to=${today}&${fq}`), 'downtime report');
    const mRow = dt.rows.find((r) => r.machineCode === ops[0].machineCode && r.reason === 'maintenance');
    check('G: the downtime report shows one planned maintenance stop', !!mRow && mRow.planned === true && mRow.events === 1);

    check('H: three simultaneous "thread empty" reports became ONE open issue', issueSnapshot?.thread === 1, `found ${issueSnapshot?.thread}`);
    check('H: the machine issue was recorded once', issueSnapshot?.machine === 1, `found ${issueSnapshot?.machine}`);
    const stillOpen = must(await callRetry(admin, 'GET', '/issues?limit=200'), 'issues').filter((i) => i.machineCode.startsWith(`TEST-${RUN}-`));
    check('H: after the manager resolved them, nothing is left open', stillOpen.length === 0, `${stillOpen.length} open`);

    if (rt.ready) {
      check('I: the live manager screen received piece events during the load, without dropping', rt.events > 0 && rt.disconnects === 0, `${rt.events} events, ${rt.disconnects} disconnects`);
    } else {
      console.log('INFO  live-screen check skipped (could not open the realtime connection from this script)');
    }

    check('J: no request was throttled (in a real factory all terminals share one internet address)', rateLimited === 0, `${rateLimited} throttled responses, all retried until accepted`);

    console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED'}`);
    console.log('\nClean up the test data with the SQL from the instructions.');
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    if (maintenanceMachineId) await call(admin, 'POST', `/machines/${maintenanceMachineId}/maintenance`, { on: false });
    if (socket) socket.close();
  }
}

main().catch((e) => {
  console.error('\nSCRIPT ERROR:', e.message);
  process.exit(1);
});