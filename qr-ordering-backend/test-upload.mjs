// Tests the image upload endpoint + that menu items expose imageUrls.
// Run after `pnpm dev` + `pnpm db:seed`:  node test-upload.mjs
import process from 'node:process';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';
const API = `${BASE}/api`;
let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${extra}`);
  }
};

// A valid 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  console.log(`\nTesting image upload + menu imageUrls @ ${API}\n`);

  // Login
  const login = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
  });
  const token = (await login.json())?.data?.token;
  check('admin login', !!token);

  // Menu items expose imageUrls (seeded)
  const menu = await (await fetch(`${API}/public/menu?tableCode=TBL001`)).json();
  const items = (menu?.data?.categories ?? []).flatMap((c) => c.items);
  check(
    'every item has imageUrls array',
    items.length > 0 && items.every((i) => Array.isArray(i.imageUrls)),
  );
  const nasi = items.find((i) => i.name === 'Nasi Lemak Ayam');
  check(
    'Nasi Lemak Ayam has 3 seeded images',
    nasi?.imageUrls?.length === 3,
    `(${nasi?.imageUrls?.length})`,
  );

  // Seeded image is actually served
  if (nasi?.imageUrls?.[0]) {
    const img = await fetch(`${BASE}${nasi.imageUrls[0]}`);
    check('seeded image served (200)', img.status === 200, `(${img.status})`);
  }

  // Auth required
  const noAuth = await fetch(`${API}/admin/uploads/image`, { method: 'POST' });
  check('upload without token → 401', noAuth.status === 401, `(${noAuth.status})`);

  // Upload a PNG
  const fd = new FormData();
  fd.append('file', new Blob([PNG], { type: 'image/png' }), 'pixel.png');
  const up = await fetch(`${API}/admin/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const uj = await up.json();
  check('upload png → 201', up.status === 201, `(${up.status} ${JSON.stringify(uj)})`);
  const url = uj?.data?.url;
  check(
    'returns /uploads url',
    typeof url === 'string' && url.startsWith('/uploads/'),
    String(url),
  );
  if (url) {
    const got = await fetch(`${BASE}${url}`);
    check('uploaded file served (200)', got.status === 200, `(${got.status})`);
  }

  // Reject non-image
  const fd2 = new FormData();
  fd2.append('file', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'x.txt');
  const bad = await fetch(`${API}/admin/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd2,
  });
  check('reject non-image → 400', bad.status === 400, `(${bad.status})`);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Upload test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('crashed:', err.message);
  process.exit(1);
});
