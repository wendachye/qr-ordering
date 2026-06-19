// End-to-end smoke test for the backend API.
// Run AFTER `pnpm dev` (API on :4000) and `pnpm db:seed`.
//   node smoke-test.mjs
import process from 'node:process';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';
const API = `${BASE}/api`;
const PRINT_KEY = process.env.PRINT_AGENT_API_KEY ?? 'secret-key';
const TABLE = 'TBL001';

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function req(method, path, { token, printKey, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (printKey) headers['x-print-agent-key'] = printKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nSmoke testing ${API}\n`);

  // 1. Health
  console.log('1) Health');
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  check('GET /health ok', health?.data?.status === 'ok');

  // 2. Public table
  console.log('2) Public table');
  const table = await req('GET', `/public/tables/${TABLE}`);
  check('GET /public/tables/:code → 200', table.status === 200, `(got ${table.status})`);
  check('returns store name', !!table.json?.data?.store?.name);

  // 3. Public menu
  console.log('3) Public menu');
  const menu = await req('GET', `/public/menu?tableCode=${TABLE}`);
  check('GET /public/menu → 200', menu.status === 200, `(got ${menu.status})`);
  const items = (menu.json?.data?.categories ?? []).flatMap((c) => c.items ?? []);
  const available = items.filter((i) => i.isAvailable);
  check('menu has available items', available.length >= 2, `(found ${available.length})`);
  check('prices are numbers', typeof available[0]?.price === 'number');

  // 4. Create order
  console.log('4) Create order');
  const orderBody = {
    tableCode: TABLE,
    note: 'No peanuts',
    items: [
      { menuItemId: available[0].id, quantity: 2, note: 'No cucumber' },
      { menuItemId: available[1].id, quantity: 1 },
    ],
  };
  const created = await req('POST', '/orders', { body: orderBody });
  check('POST /orders → 201', created.status === 201, `(got ${created.status})`);
  const orderId = created.json?.data?.id;
  const orderNumber = created.json?.data?.orderNumber;
  check('returns order id + number', !!orderId && !!orderNumber, JSON.stringify(created.json));
  check('totalItems = 3', created.json?.data?.totalItems === 3);
  // server-side price recalculation
  const expectTotal = available[0].price * 2 + available[1].price * 1;
  check(
    'total recalculated server-side',
    created.json?.data?.total === expectTotal,
    `(got ${created.json?.data?.total}, expected ${expectTotal})`,
  );

  // 4b. Reject sold-out / unknown item
  const badOrder = await req('POST', '/orders', {
    body: { tableCode: TABLE, items: [{ menuItemId: 'does-not-exist', quantity: 1 }] },
  });
  check('unknown item rejected (400)', badOrder.status === 400, `(got ${badOrder.status})`);

  // 5. Admin login
  console.log('5) Admin auth');
  const login = await req('POST', '/admin/auth/login', {
    body: { email: 'admin@example.com', password: 'password123' },
  });
  check('login → 200 with token', login.status === 200 && !!login.json?.data?.token);
  const token = login.json?.data?.token;
  const badLogin = await req('POST', '/admin/auth/login', {
    body: { email: 'admin@example.com', password: 'wrong' },
  });
  check('wrong password → 401', badLogin.status === 401, `(got ${badLogin.status})`);
  const me = await req('GET', '/admin/auth/me', { token });
  check(
    'GET /me with token → 200',
    me.status === 200 && me.json?.data?.email === 'admin@example.com',
  );
  const noAuth = await req('GET', '/admin/orders');
  check('admin route without token → 401', noAuth.status === 401, `(got ${noAuth.status})`);

  // 6. Admin sees the order
  console.log('6) Admin orders');
  const orders = await req('GET', '/admin/orders', { token });
  check('GET /admin/orders → 200', orders.status === 200);
  const found = (orders.json?.data ?? []).find((o) => o.id === orderId);
  check('new order present in list', !!found);
  check('order status NEW', found?.status === 'NEW');
  check(
    'order print status PENDING',
    found?.printStatus === 'PENDING',
    `(got ${found?.printStatus})`,
  );

  const detail = await req('GET', `/admin/orders/${orderId}`, { token });
  check('GET /admin/orders/:id → 200', detail.status === 200);
  check('detail has 2 line items', detail.json?.data?.items?.length === 2);
  check('detail has 1 print job', detail.json?.data?.printJobs?.length === 1);

  // 7. Print agent queue
  console.log('7) Print agent queue');
  const noKey = await req('GET', '/print-agent/jobs/pending');
  check('print-agent route without key → 401', noKey.status === 401, `(got ${noKey.status})`);
  const pending = await req('GET', '/print-agent/jobs/pending', { printKey: PRINT_KEY });
  check('GET pending jobs → 200', pending.status === 200);
  const job = (pending.json?.data ?? []).find((j) => j.orderId === orderId);
  check('our job is pending', !!job, '(it may already be printed if the agent is running)');
  if (job) {
    check('payload has orderNumber', job.payload?.orderNumber === orderNumber);
    check('payload totalItems = 3', job.payload?.totalItems === 3);
    check('payload tableName set', !!job.payload?.tableName);
  }

  // 8. Reprint
  console.log('8) Reprint');
  const reprint = await req('POST', `/admin/orders/${orderId}/reprint`, { token });
  check(
    'reprint → 200 with printJobId',
    reprint.status === 200 && !!reprint.json?.data?.printJobId,
  );

  // 9. Complete order
  console.log('9) Update status');
  const complete = await req('PATCH', `/admin/orders/${orderId}/status`, {
    token,
    body: { status: 'COMPLETED' },
  });
  check(
    'PATCH status → COMPLETED',
    complete.status === 200 && complete.json?.data?.status === 'COMPLETED',
  );

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Smoke test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err.message);
  process.exit(1);
});
