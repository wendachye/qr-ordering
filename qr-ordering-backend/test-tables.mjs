// Tests the admin table CRUD endpoints. Run after `pnpm dev`:
//   node test-tables.mjs
const API = 'http://localhost:4000/api';
let pass = 0,
  fail = 0;
const ck = (n, c, x = '') => {
  if (c) {
    pass++;
    console.log(`  ✅ ${n}`);
  } else {
    fail++;
    console.log(`  ❌ ${n} ${x}`);
  }
};

const token = (
  await (
    await fetch(`${API}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    })
  ).json()
)?.data?.token;
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

console.log('\nTesting admin table CRUD\n');

// List
const list = (await (await fetch(`${API}/admin/tables`, { headers: auth })).json())?.data ?? [];
ck('list tables >= 10', list.length >= 10, `(${list.length})`);
ck('table has code + orderCount', !!list[0]?.code && typeof list[0]?.orderCount === 'number');
const tbl001 = list.find((t) => t.code === 'TBL001');
ck('TBL001 shows order count > 0', (tbl001?.orderCount ?? 0) > 0, `(${tbl001?.orderCount})`);

// Create
const cr = await fetch(`${API}/admin/tables`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: 'Patio 1', code: 'PATIO1' }),
});
const crj = await cr.json();
ck('create table → 201', cr.status === 201, `(${cr.status} ${JSON.stringify(crj)})`);
const id = crj?.data?.id;

// Duplicate code rejected
const dup = await fetch(`${API}/admin/tables`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: 'Dup', code: 'PATIO1' }),
});
ck('duplicate code → 409', dup.status === 409, `(${dup.status})`);

// New table is orderable from the public side
const pubActive = await fetch(`${API}/public/tables/PATIO1`);
ck('new table reachable publicly (200)', pubActive.status === 200, `(${pubActive.status})`);

// Deactivate
const pa = await fetch(`${API}/admin/tables/${id}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ isActive: false }),
});
ck('deactivate → isActive false', pa.status === 200 && (await pa.json())?.data?.isActive === false);
const pubInactive = await fetch(`${API}/public/tables/PATIO1`);
ck('inactive table rejected publicly (400)', pubInactive.status === 400, `(${pubInactive.status})`);

// Delete (no orders)
const del = await fetch(`${API}/admin/tables/${id}`, { method: 'DELETE', headers: auth });
ck('delete empty table → 200', del.status === 200, `(${del.status})`);

// Delete a table with orders → blocked
if (tbl001) {
  const delSeed = await fetch(`${API}/admin/tables/${tbl001.id}`, {
    method: 'DELETE',
    headers: auth,
  });
  ck('delete table with orders → 409', delSeed.status === 409, `(${delSeed.status})`);
}

// Auth required
const noAuth = await fetch(`${API}/admin/tables`);
ck('tables route without token → 401', noAuth.status === 401, `(${noAuth.status})`);

console.log(`\n${'='.repeat(40)}\nTable test: ${pass} passed, ${fail} failed\n${'='.repeat(40)}`);
process.exit(fail === 0 ? 0 : 1);
