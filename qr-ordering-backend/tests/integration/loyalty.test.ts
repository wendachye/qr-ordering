import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

async function tenant() {
  const { data } = await registerTenant();
  return data.token as string;
}

async function configure(token: string, patch: Record<string, unknown>) {
  const res = await api().patch('/api/admin/loyalty/config').set(auth(token)).send(patch);
  expect(res.status).toBe(200);
  return res.body.data;
}

async function createMember(token: string, body: Record<string, unknown>) {
  return api().post('/api/admin/loyalty/members').set(auth(token)).send(body);
}

describe('loyalty — program config', () => {
  it('round-trips config incl. the tier ladder', async () => {
    const token = await tenant();
    const cfg = await configure(token, {
      loyaltyEnabled: true,
      earnRatePoints: 2,
      redeemRatePoints: 50,
      welcomeBonusPoints: 100,
      tierThresholds: [
        { tier: 'SILVER', threshold: 100, earnMultiplier: 1.5 },
        { tier: 'GOLD', threshold: 500, earnMultiplier: 2 },
      ],
    });
    expect(cfg.loyaltyEnabled).toBe(true);
    expect(cfg.earnRatePoints).toBe(2);
    expect(cfg.redeemRatePoints).toBe(50);
    expect(cfg.tierThresholds).toHaveLength(2);
    expect(cfg.tierThresholds[0].tier).toBe('SILVER');

    const got = (await api().get('/api/admin/loyalty/config').set(auth(token))).body.data;
    expect(got.welcomeBonusPoints).toBe(100);
    expect(got.tierThresholds[1].tier).toBe('GOLD');
  });
});

describe('loyalty — members', () => {
  it('enrols a member with a welcome bonus + tier, logged in the ledger', async () => {
    const token = await tenant();
    await configure(token, {
      loyaltyEnabled: true,
      welcomeBonusPoints: 150,
      tierThresholds: [{ tier: 'SILVER', threshold: 100, earnMultiplier: 1.5 }],
    });
    const res = await createMember(token, { phone: '+60123456789', name: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.data.pointsBalance).toBe(150);
    expect(res.body.data.lifetimePoints).toBe(150);
    expect(res.body.data.tier).toBe('SILVER');

    const detail = (
      await api().get(`/api/admin/loyalty/members/${res.body.data.id}`).set(auth(token))
    ).body.data;
    const bonus = detail.pointsLedger.find((l: any) => l.type === 'BONUS');
    expect(bonus.points).toBe(150);
  });

  it('grants no bonus when none is configured', async () => {
    const token = await tenant();
    await configure(token, { loyaltyEnabled: true, welcomeBonusPoints: 0 });
    const res = await createMember(token, { phone: '0111111111' });
    expect(res.status).toBe(201);
    expect(res.body.data.pointsBalance).toBe(0);
    expect(res.body.data.tier).toBe('BRONZE');
  });

  it('rejects a duplicate phone in the same store', async () => {
    const token = await tenant();
    await createMember(token, { phone: '0122223333' });
    const dup = await createMember(token, { phone: '012-222 3333' }); // normalises equal
    expect(dup.status).toBe(409);
  });

  it('finds a member by a loosely-typed phone search', async () => {
    const token = await tenant();
    await createMember(token, { phone: '012-345 6789', name: 'Bob' });
    const found = (await api().get('/api/admin/loyalty/members?search=0123456789').set(auth(token)))
      .body.data;
    expect(found.some((m: any) => m.name === 'Bob')).toBe(true);
  });

  it('adjusts points (balance + ledger move together) and refuses to go below zero', async () => {
    const token = await tenant();
    await configure(token, { loyaltyEnabled: true, welcomeBonusPoints: 0 });
    const m = (await createMember(token, { phone: '0144445555' })).body.data;

    const up = await api()
      .post(`/api/admin/loyalty/members/${m.id}/adjust`)
      .set(auth(token))
      .send({ points: 80, reason: 'Goodwill' });
    expect(up.status).toBe(200);
    expect(up.body.data.pointsBalance).toBe(80);

    const down = await api()
      .post(`/api/admin/loyalty/members/${m.id}/adjust`)
      .set(auth(token))
      .send({ points: -30 });
    expect(down.body.data.pointsBalance).toBe(50);

    const tooFar = await api()
      .post(`/api/admin/loyalty/members/${m.id}/adjust`)
      .set(auth(token))
      .send({ points: -1000 });
    expect(tooFar.status).toBe(400);

    // balance == sum(ledger)
    const detail = (await api().get(`/api/admin/loyalty/members/${m.id}`).set(auth(token))).body
      .data;
    const sum = detail.pointsLedger.reduce((a: number, l: any) => a + l.points, 0);
    expect(sum).toBe(detail.pointsBalance);
  });
});

describe('loyalty — reward catalog', () => {
  async function firstItemId(token: string) {
    const items = (await api().get('/api/admin/menu/items').set(auth(token))).body.data;
    return items[0].id as string;
  }

  it('creates fixed-voucher + free-item rewards and validates them', async () => {
    const token = await tenant();
    const itemId = await firstItemId(token);

    const fixed = await api()
      .post('/api/admin/loyalty/rewards')
      .set(auth(token))
      .send({ name: 'RM5 off', pointsCost: 500, type: 'FIXED_VOUCHER', value: 5 });
    expect(fixed.status).toBe(201);
    expect(fixed.body.data.value).toBeCloseTo(5, 2);

    const free = await api()
      .post('/api/admin/loyalty/rewards')
      .set(auth(token))
      .send({ name: 'Free item', pointsCost: 800, type: 'FREE_ITEM', menuItemId: itemId });
    expect(free.status).toBe(201);

    // missing value / item → 400
    expect(
      (
        await api()
          .post('/api/admin/loyalty/rewards')
          .set(auth(token))
          .send({ name: 'x', pointsCost: 100, type: 'FIXED_VOUCHER' })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .post('/api/admin/loyalty/rewards')
          .set(auth(token))
          .send({ name: 'y', pointsCost: 100, type: 'FREE_ITEM' })
      ).status,
    ).toBe(400);

    const list = (await api().get('/api/admin/loyalty/rewards').set(auth(token))).body.data;
    expect(list.map((r: any) => r.pointsCost)).toEqual([500, 800]); // sorted asc
  });

  it('deletes an unused reward', async () => {
    const token = await tenant();
    const r = (
      await api()
        .post('/api/admin/loyalty/rewards')
        .set(auth(token))
        .send({ name: 'Temp', pointsCost: 100, type: 'FIXED_VOUCHER', value: 1 })
    ).body.data;
    const del = await api().delete(`/api/admin/loyalty/rewards/${r.id}`).set(auth(token));
    expect(del.status).toBe(200);
    expect(del.body.data.deactivated).toBe(false);
  });
});

describe('loyalty — tenant isolation', () => {
  it('never exposes one store’s members to another', async () => {
    const a = await tenant();
    const b = await tenant();
    const m = (await createMember(a, { phone: '0199998888', name: 'Secret' })).body.data;

    const cross = await api().get(`/api/admin/loyalty/members/${m.id}`).set(auth(b));
    expect(cross.status).toBe(404);

    const bList = (await api().get('/api/admin/loyalty/members').set(auth(b))).body.data;
    expect(bList.some((x: any) => x.id === m.id)).toBe(false);
  });
});
