import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

// Settlement earn/redeem: a member attached to a tab earns points when it settles
// and can redeem points as a bill discount (burned at settlement, reversed on
// reopen). Mirrors the production money-path (recordPayment / reopenSession).

async function ctx(cfg: Record<string, unknown> = {}) {
  const { data } = await registerTenant();
  const token = data.token as string;
  await api()
    .patch('/admin/loyalty/config')
    .set(auth(token))
    .send({ loyaltyEnabled: true, pointsEnabled: true, welcomeBonusPoints: 0, ...cfg });
  const cats = (await api().get('/admin/menu/categories').set(auth(token))).body.data;
  const categoryId = cats[0].id as string;
  const mk = (name: string, price: number) =>
    api()
      .post('/admin/menu/items')
      .set(auth(token))
      .send({ categoryId, name, price })
      .then((r) => r.body.data);
  const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
  return { token, mk, code: tables[0].code as string };
}

const order = (code: string, menuItemId: string, quantity: number) =>
  api().post('/orders').send({ tableCode: code, items: [{ menuItemId, quantity }] });

const newSession = async (code: string, menuItemId: string, qty: number) =>
  (await order(code, menuItemId, qty)).body.data.sessionId as string;

const attach = (token: string, sessionId: string, phone: string, name?: string) =>
  api().post(`/admin/sessions/${sessionId}/member`).set(auth(token)).send({ phone, name });

const seedMember = async (token: string, phone: string, points: number) => {
  const m = (await api().post('/admin/loyalty/members').set(auth(token)).send({ phone })).body.data;
  if (points > 0) {
    await api().post(`/admin/loyalty/members/${m.id}/adjust`).set(auth(token)).send({ points });
  }
  return m.id as string;
};

const memberDetail = async (token: string, id: string) =>
  (await api().get(`/admin/loyalty/members/${id}`).set(auth(token))).body.data;

const close = (token: string, sessionId: string) =>
  api().post(`/admin/sessions/${sessionId}/close`).set(auth(token)).send({ paymentMethod: 'Cash' });

describe('loyalty — earn at settlement', () => {
  it('earns floor(net × rate) for the attached member when the tab settles', async () => {
    const { token, mk, code } = await ctx({ earnRatePoints: 1 });
    const item = await mk('Earner', 50);
    const sessionId = await newSession(code, item.id, 2); // RM100

    const attached = await attach(token, sessionId, '0123456789', 'Ann');
    expect(attached.status).toBe(200);
    const memberId = attached.body.data.member.id as string;

    const closed = await close(token, sessionId);
    expect(closed.status).toBe(200);
    const net = closed.body.data.netTotal as number; // 100
    expect(closed.body.data.pointsEarned).toBe(Math.floor(net));

    const member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(Math.floor(net));
    expect(member.lifetimeSpend).toBe(net);
    expect(
      member.pointsLedger.some((l: any) => l.type === 'EARN' && l.sessionId === sessionId),
    ).toBe(true);
  });

  it('earns exactly once across a split payment', async () => {
    const { token, mk, code } = await ctx({ earnRatePoints: 1 });
    const item = await mk('Split', 100);
    const sessionId = await newSession(code, item.id, 1);
    const memberId = (await attach(token, sessionId, '0127770000')).body.data.member.id;

    const p1 = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: 60 });
    expect(p1.body.data.status).toBe('OPEN');
    const p2 = await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: 40 });
    expect(p2.body.data.status).toBe('CLOSED');

    const member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(100);
    expect(member.pointsLedger.filter((l: any) => l.type === 'EARN')).toHaveLength(1);
  });

  it('applies the tier multiplier to earned points', async () => {
    const { token, mk, code } = await ctx({
      earnRatePoints: 1,
      tierThresholds: [{ tier: 'GOLD', threshold: 0, earnMultiplier: 2 }],
    });
    const item = await mk('Gold', 50);
    const sessionId = await newSession(code, item.id, 1); // RM50
    const memberId = (await attach(token, sessionId, '0126661111')).body.data.member.id;
    await close(token, sessionId);
    const member = await memberDetail(token, memberId);
    expect(member.tier).toBe('GOLD');
    expect(member.pointsBalance).toBe(100); // 50 × 2.0
  });

  it('earns nothing when the points program is disabled', async () => {
    const { token, mk, code } = await ctx({ loyaltyEnabled: false });
    const item = await mk('NoEarn', 50);
    const sessionId = await newSession(code, item.id, 1);
    const memberId = (await attach(token, sessionId, '0128880000')).body.data.member.id;
    await close(token, sessionId);
    const member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(0);
  });
});

describe('loyalty — redeem points as a bill discount', () => {
  it('reduces the net and burns the points at settlement', async () => {
    const { token, mk, code } = await ctx({
      earnRatePoints: 0,
      redeemRatePoints: 100,
      minRedeemPoints: 100,
      maxRedeemPercent: 100,
    });
    const item = await mk('Redeemable', 80);
    const memberId = await seedMember(token, '0125550000', 1000);
    const sessionId = await newSession(code, item.id, 1); // RM80
    await attach(token, sessionId, '0125550000');

    const redeemed = await api()
      .post(`/admin/sessions/${sessionId}/redeem`)
      .set(auth(token))
      .send({ points: 500 }); // 500 / 100 = RM5
    expect(redeemed.status).toBe(200);
    expect(redeemed.body.data.loyaltyDiscount).toBe(5);
    expect(redeemed.body.data.netTotal).toBe(75);

    expect((await close(token, sessionId)).status).toBe(200);
    const member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(500); // 1000 − 500
    expect(
      member.pointsLedger.some(
        (l: any) => l.type === 'REDEEM' && l.points === -500 && l.sessionId === sessionId,
      ),
    ).toBe(true);
  });

  it('enforces the minimum-redeem and max-percent caps', async () => {
    const { token, mk, code } = await ctx({
      redeemRatePoints: 100,
      minRedeemPoints: 100,
      maxRedeemPercent: 50,
    });
    const item = await mk('Capped', 10); // RM10 bill → 50% cap = RM5 = 500 pts
    await seedMember(token, '0129990000', 2000);
    const sessionId = await newSession(code, item.id, 1);
    await attach(token, sessionId, '0129990000');

    const path = `/admin/sessions/${sessionId}/redeem`;
    expect((await api().post(path).set(auth(token)).send({ points: 50 })).status).toBe(400); // < min
    expect((await api().post(path).set(auth(token)).send({ points: 600 })).status).toBe(400); // > cap
    const ok = await api().post(path).set(auth(token)).send({ points: 500 }); // == cap
    expect(ok.status).toBe(200);
    expect(ok.body.data.loyaltyDiscount).toBe(5);
  });

  it('refuses to redeem without a member, beyond balance, or after a tender', async () => {
    const { token, mk, code } = await ctx({
      redeemRatePoints: 100,
      minRedeemPoints: 1,
      maxRedeemPercent: 100,
    });
    const item = await mk('Guard', 100);
    const sessionId = await newSession(code, item.id, 1);
    const path = `/admin/sessions/${sessionId}/redeem`;

    expect((await api().post(path).set(auth(token)).send({ points: 100 })).status).toBe(400); // no member

    const attached = await attach(token, sessionId, '0121110000');
    await api()
      .post(`/admin/loyalty/members/${attached.body.data.member.id}/adjust`)
      .set(auth(token))
      .send({ points: 50 });
    expect((await api().post(path).set(auth(token)).send({ points: 100 })).status).toBe(400); // > balance

    await api()
      .post(`/admin/loyalty/members/${attached.body.data.member.id}/adjust`)
      .set(auth(token))
      .send({ points: 1000 });
    await api()
      .post(`/admin/sessions/${sessionId}/pay`)
      .set(auth(token))
      .send({ paymentMethod: 'Cash', amount: 50 });
    expect((await api().post(path).set(auth(token)).send({ points: 100 })).status).toBe(409); // after tender
  });
});

describe('loyalty — reopen reversal', () => {
  it('reverses earn and restores redeemed points when a settled tab is reopened', async () => {
    const { token, mk, code } = await ctx({
      earnRatePoints: 1,
      redeemRatePoints: 100,
      minRedeemPoints: 100,
      maxRedeemPercent: 100,
    });
    const item = await mk('Both', 100);
    const memberId = await seedMember(token, '0126660000', 1000);
    const sessionId = await newSession(code, item.id, 1); // RM100
    await attach(token, sessionId, '0126660000');
    await api()
      .post(`/admin/sessions/${sessionId}/redeem`)
      .set(auth(token))
      .send({ points: 200 }); // RM2 off → net 98

    const closed = await close(token, sessionId);
    expect(closed.body.data.netTotal).toBe(98);
    let member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(898); // 1000 − 200 redeem + 98 earn
    expect(member.lifetimeSpend).toBe(98);

    const reopened = await api()
      .post(`/admin/sessions/${sessionId}/reopen`)
      .set(auth(token))
      .send({});
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.loyaltyDiscount).toBe(0);
    expect(reopened.body.data.pointsRedeemed).toBe(0);
    expect(reopened.body.data.pointsEarned).toBe(0);
    expect(reopened.body.data.member.id).toBe(memberId); // member stays attached

    member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(1000); // fully restored
    expect(member.lifetimeSpend).toBe(0);
  });
});

describe('loyalty — settlement hardening (review fixes)', () => {
  it('treats maxRedeemPercent=0 as redemption disabled (not unlimited)', async () => {
    const { token, mk, code } = await ctx({
      redeemRatePoints: 100,
      minRedeemPoints: 1,
      maxRedeemPercent: 0,
    });
    const item = await mk('NoRedeem', 50);
    await seedMember(token, '0123334444', 1000);
    const sessionId = await newSession(code, item.id, 1);
    await attach(token, sessionId, '0123334444');
    const res = await api()
      .post(`/admin/sessions/${sessionId}/redeem`)
      .set(auth(token))
      .send({ points: 100 });
    expect(res.status).toBe(400); // 0% cap → nothing redeemable
  });

  it('unwinds lifetimeSpend on reopen even when no points were earned', async () => {
    const { token, mk, code } = await ctx({ earnRatePoints: 0 });
    const item = await mk('SpendOnly', 50);
    const sessionId = await newSession(code, item.id, 1);
    const memberId = (await attach(token, sessionId, '0125556666')).body.data.member.id;
    await close(token, sessionId);
    let member = await memberDetail(token, memberId);
    expect(member.pointsBalance).toBe(0);
    expect(member.lifetimeSpend).toBe(50);

    await api().post(`/admin/sessions/${sessionId}/reopen`).set(auth(token)).send({});
    member = await memberDetail(token, memberId);
    expect(member.lifetimeSpend).toBe(0); // spend unwound despite 0 points earned
  });

  it('carries the source tab member onto the combined tab', async () => {
    const { token, mk } = await ctx({ earnRatePoints: 1 });
    const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
    const item = await mk('Combine', 30);
    const sourceId = await newSession(tables[0].code, item.id, 1);
    const targetId = await newSession(tables[1].code, item.id, 1);
    const memberId = (await attach(token, sourceId, '0127778888')).body.data.member.id;

    const combined = await api()
      .post(`/admin/sessions/${targetId}/combine`)
      .set(auth(token))
      .send({ sourceSessionId: sourceId });
    expect(combined.status).toBe(200);
    expect(combined.body.data.member?.id).toBe(memberId);
  });

  it('refuses to combine when the source has a locked redemption', async () => {
    const { token, mk } = await ctx({
      redeemRatePoints: 100,
      minRedeemPoints: 1,
      maxRedeemPercent: 100,
    });
    const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
    const item = await mk('CombineBlock', 40);
    await seedMember(token, '0129990001', 1000);
    const sourceId = await newSession(tables[0].code, item.id, 1);
    const targetId = await newSession(tables[1].code, item.id, 1);
    await attach(token, sourceId, '0129990001');
    await api().post(`/admin/sessions/${sourceId}/redeem`).set(auth(token)).send({ points: 200 });

    const res = await api()
      .post(`/admin/sessions/${targetId}/combine`)
      .set(auth(token))
      .send({ sourceSessionId: sourceId });
    expect(res.status).toBe(409);
  });
});
