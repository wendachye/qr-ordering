// Verifies item options end-to-end: menu exposes option groups, order validates
// + prices them, snapshot persists, and the kitchen ticket payload carries them.
//   node test-options.mjs   (after pnpm dev + reseed)
import process from 'node:process';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';
const API = `${BASE}/api`;
const PRINT_KEY = process.env.PRINT_AGENT_API_KEY ?? 'secret-key';
const TABLE = 'TBL001';
let passed = 0;
let failed = 0;
const check = (n, c, x = '') => {
  if (c) {
    passed++;
    console.log(`  ✅ ${n}`);
  } else {
    failed++;
    console.log(`  ❌ ${n} ${x}`);
  }
};

async function req(method, path, { token, printKey, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
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

const choiceId = (item, groupName, choicePrefix) =>
  (item.optionGroups || [])
    .find((g) => g.name === groupName)
    ?.choices.find((c) => c.name.startsWith(choicePrefix))?.id;

async function main() {
  console.log(`\nTesting item options @ ${API}\n`);

  const menu = (await req('GET', `/public/menu?tableCode=${TABLE}`)).json;
  const items = (menu.data?.categories || []).flatMap((c) => c.items);
  check(
    'menu has 8 categories',
    menu.data?.categories?.length === 8,
    `(${menu.data?.categories?.length})`,
  );
  check(
    'items expose optionGroups',
    items.every((i) => Array.isArray(i.optionGroups)),
  );

  const ramen = items.find((i) => i.name === 'Tonkotsu Ramen');
  const salmon = items.find((i) => i.name === 'Grilled Salmon');
  check('Tonkotsu Ramen has 2 option groups', ramen?.optionGroups?.length === 2);
  check(
    'Grilled Salmon has Cooking method',
    !!ramen &&
      ramen.optionGroups &&
      !!salmon?.optionGroups?.find((g) => g.name === 'Cooking method'),
  );

  const hot = choiceId(ramen, 'Spice level', 'Hot');
  const chashu = choiceId(ramen, 'Add-ons', 'Extra Chashu');
  const egg = choiceId(ramen, 'Add-ons', 'Ajitama');
  const teriyaki = choiceId(salmon, 'Cooking method', 'Teriyaki');
  check('resolved option choice ids', !!(hot && chashu && egg && teriyaki));

  // Order: ramen (22 + 5 + 3 = 30) + salmon (24) = 54
  const order = await req('POST', '/orders', {
    body: {
      tableCode: TABLE,
      items: [
        { menuItemId: ramen.id, quantity: 1, optionChoiceIds: [hot, chashu, egg] },
        { menuItemId: salmon.id, quantity: 1, optionChoiceIds: [teriyaki] },
      ],
    },
  });
  check('order with options created (201)', order.status === 201, JSON.stringify(order.json));
  check(
    'total includes option price deltas (54)',
    order.json?.data?.total === 54,
    `(got ${order.json?.data?.total})`,
  );
  const orderId = order.json?.data?.id;

  // Required option missing → 400
  const bad = await req('POST', '/orders', {
    body: { tableCode: TABLE, items: [{ menuItemId: ramen.id, quantity: 1, optionChoiceIds: [] }] },
  });
  check('missing required option rejected (400)', bad.status === 400, `(${bad.status})`);

  // Foreign choice id rejected
  const bad2 = await req('POST', '/orders', {
    body: {
      tableCode: TABLE,
      items: [{ menuItemId: salmon.id, quantity: 1, optionChoiceIds: [hot] }],
    },
  });
  check('option from another item rejected (400)', bad2.status === 400, `(${bad2.status})`);

  // Admin detail carries the option snapshot
  const token = (
    await req('POST', '/admin/auth/login', {
      body: { email: 'admin@example.com', password: 'password123' },
    })
  ).json?.data?.token;
  const detail = await req('GET', `/admin/orders/${orderId}`, { token });
  const ramenLine = detail.json?.data?.items?.find((i) => i.name === 'Tonkotsu Ramen');
  check(
    'order item carries 3 selectedOptions',
    ramenLine?.selectedOptions?.length === 3,
    JSON.stringify(ramenLine?.selectedOptions),
  );
  check(
    'snapshot has "Spice level: Hot"',
    !!ramenLine?.selectedOptions?.some((o) => o.group === 'Spice level' && o.choice === 'Hot'),
  );

  // Kitchen ticket payload carries option strings
  const pending = await req('GET', '/print-agent/jobs/pending', { printKey: PRINT_KEY });
  const job = (pending.json?.data || []).find((j) => j.orderId === orderId);
  const jramen = job?.payload?.items?.find((i) => i.name === 'Tonkotsu Ramen');
  check(
    'print payload item has 3 options',
    jramen?.options?.length === 3,
    JSON.stringify(jramen?.options),
  );
  check('print option formatted "Group: Choice"', !!jramen?.options?.includes('Spice level: Hot'));

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Options test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('crashed:', err.message);
  process.exit(1);
});
