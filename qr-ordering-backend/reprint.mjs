// Reprints an order (default: #1001) so the running print agent re-renders its
// kitchen ticket. Usage: node reprint.mjs [orderNumber]
const API = 'http://localhost:4000/api';
const wantNumber = Number(process.argv[2] ?? 1001);

const login = await fetch(`${API}/admin/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
});
const token = (await login.json())?.data?.token;

const orders =
  (
    await (
      await fetch(`${API}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()
  )?.data ?? [];

const target = orders.find((o) => o.orderNumber === wantNumber) ?? orders[0];
if (!target) {
  console.log('No orders to reprint.');
  process.exit(1);
}

const r = await fetch(`${API}/admin/orders/${target.id}/reprint`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
console.log(`Reprint order #${target.orderNumber}:`, r.status, JSON.stringify(await r.json()));
