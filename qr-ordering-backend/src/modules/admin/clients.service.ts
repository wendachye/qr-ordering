import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { config } from '../../config/env';
import { signAdminToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { writeAudit } from '../../lib/audit';
import { slugify } from '../../lib/slug';
import { randomTableCode } from '../../lib/code';
import type {
  AddOutletInput,
  ApplyPlanInput,
  CreateClientInput,
  UpdateClientInput,
  UpdateOutletInput,
} from '../../validators/platform';

// Platform super-admin service: manages CLIENTS (accounts) and their OUTLETS
// (Stores) ACROSS all tenants. Intentionally NOT tenant-scoped — every query
// takes an explicit id. Gated by requirePlatformAdmin at the route.

const STARTER_TABLE_COUNT = 4;

const OUTLET_SELECT = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  isActive: true,
  createdAt: true,
  _count: { select: { tables: true, items: true } },
} satisfies Prisma.StoreSelect;

type OutletRow = {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  _count: { tables: number; items: number };
};

function outletDto(s: OutletRow) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    plan: s.plan,
    subscriptionStatus: s.subscriptionStatus,
    trialEndsAt: s.trialEndsAt,
    isActive: s.isActive,
    tableCount: s._count.tables,
    menuItemCount: s._count.items,
    createdAt: s.createdAt,
  };
}

type ClientRow = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function clientDto(c: ClientRow, outlets: OutletRow[]) {
  return {
    id: c.id,
    name: c.name,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    notes: c.notes,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    outletCount: outlets.length,
    outlets: outlets.map(outletDto),
  };
}

function p2002Target(err: unknown): string[] {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== 'P2002') return [];
  const t = e.meta?.target;
  return Array.isArray(t) ? t.map(String) : typeof t === 'string' ? [t] : [];
}

// Create an outlet (Store) under a client + its starter workspace + optional
// owner admin login. Runs inside a transaction (caller handles P2002 retry).
async function provisionOutlet(
  tx: Prisma.TransactionClient,
  args: {
    clientId: string;
    name: string;
    planKey: 'basic' | 'pro';
    trialDays?: number;
    adminEmail?: string;
    adminPassword?: string;
  },
) {
  const baseSlug = slugify(args.name) || 'outlet';
  let slug = baseSlug;
  let n = 1;
  while (await tx.store.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const trialDays = args.trialDays ?? config.billing.trialDays;
  const onTrial = trialDays > 0;
  const store = await tx.store.create({
    data: {
      name: args.name,
      slug,
      clientId: args.clientId,
      plan: args.planKey,
      subscriptionStatus: onTrial ? 'TRIALING' : 'ACTIVE',
      trialEndsAt: onTrial ? new Date(Date.now() + trialDays * 86_400_000) : null,
    },
  });

  const category = await tx.menuCategory.create({
    data: { storeId: store.id, name: 'Mains', sortOrder: 1 },
  });
  await tx.menuItem.create({
    data: {
      storeId: store.id,
      categoryId: category.id,
      name: 'Sample Dish',
      price: 10,
      sortOrder: 1,
    },
  });
  const used = new Set<string>();
  for (let i = 1; i <= STARTER_TABLE_COUNT; i++) {
    let code = randomTableCode();
    while (used.has(code) || (await tx.table.findUnique({ where: { code } })))
      code = randomTableCode();
    used.add(code);
    await tx.table.create({ data: { storeId: store.id, name: `Table ${i}`, code } });
  }

  if (args.adminEmail) {
    const passwordHash = await bcrypt.hash(args.adminPassword!, 10);
    await tx.adminUser.create({
      data: { email: args.adminEmail.toLowerCase(), password: passwordHash, storeId: store.id },
    });
  }
  return store;
}

export async function listClients() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: { outlets: { orderBy: { createdAt: 'asc' }, select: OUTLET_SELECT } },
  });
  return clients.map((c) => clientDto(c, c.outlets));
}

export async function getClient(id: string) {
  const c = await prisma.client.findUnique({
    where: { id },
    include: { outlets: { orderBy: { createdAt: 'asc' }, select: OUTLET_SELECT } },
  });
  if (!c) throw ApiError.notFound('Client not found');
  return clientDto(c, c.outlets);
}

export async function createClient(input: CreateClientInput) {
  if (input.adminEmail) {
    const existing = await prisma.adminUser.findUnique({
      where: { email: input.adminEmail.toLowerCase() },
    });
    if (existing) throw ApiError.conflict('An account with this email already exists');
  }

  let createdId = '';
  for (let attempt = 0; ; attempt++) {
    try {
      createdId = await prisma.$transaction(async (tx) => {
        const c = await tx.client.create({
          data: {
            name: input.clientName,
            contactEmail: input.contactEmail?.trim() || null,
            contactPhone: input.contactPhone?.trim() || null,
            notes: input.notes?.trim() || null,
          },
        });
        await provisionOutlet(tx, {
          clientId: c.id,
          name: input.outletName,
          planKey: input.planKey,
          trialDays: input.trialDays,
          adminEmail: input.adminEmail,
          adminPassword: input.adminPassword,
        });
        return c.id;
      });
      break;
    } catch (err) {
      const target = p2002Target(err);
      if (target.some((t) => t.includes('email'))) {
        throw ApiError.conflict('An account with this email already exists');
      }
      if (target.length > 0 && attempt < 4) continue;
      throw err;
    }
  }
  await writeAudit({
    action: 'client.create',
    entity: 'Client',
    entityId: createdId,
    summary: `Created client "${input.clientName}" with outlet "${input.outletName}"`,
  });
  return getClient(createdId);
}

export async function updateClient(id: string, input: UpdateClientInput) {
  const existing = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw ApiError.notFound('Client not found');
  const data: Prisma.ClientUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail?.trim() || null;
  if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone?.trim() || null;
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  await prisma.client.update({ where: { id }, data });
  await writeAudit({ action: 'client.update', entity: 'Client', entityId: id, metadata: input });
  return getClient(id);
}

export async function addOutlet(clientId: string, input: AddOutletInput) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw ApiError.notFound('Client not found');
  let outletStoreId = '';
  if (input.adminEmail) {
    const existing = await prisma.adminUser.findUnique({
      where: { email: input.adminEmail.toLowerCase() },
    });
    if (existing) throw ApiError.conflict('An account with this email already exists');
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const store = await prisma.$transaction((tx) =>
        provisionOutlet(tx, {
          clientId,
          name: input.outletName,
          planKey: input.planKey,
          trialDays: input.trialDays,
          adminEmail: input.adminEmail,
          adminPassword: input.adminPassword,
        }),
      );
      outletStoreId = store.id;
      break;
    } catch (err) {
      const target = p2002Target(err);
      if (target.some((t) => t.includes('email'))) {
        throw ApiError.conflict('An account with this email already exists');
      }
      if (target.length > 0 && attempt < 4) continue;
      throw err;
    }
  }
  await writeAudit({
    action: 'outlet.create',
    entity: 'Store',
    entityId: outletStoreId,
    storeId: outletStoreId,
    summary: `Added outlet "${input.outletName}" to client ${clientId}`,
  });
  return getClient(clientId);
}

export async function updateOutlet(storeId: string, input: UpdateOutletInput) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, clientId: true },
  });
  if (!store) throw ApiError.notFound('Outlet not found');
  const data: Prisma.StoreUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.plan !== undefined) data.plan = input.plan;
  if (input.subscriptionStatus !== undefined) data.subscriptionStatus = input.subscriptionStatus;
  if (input.trialEndsAt !== undefined) {
    data.trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;
  await prisma.store.update({ where: { id: storeId }, data });
  await writeAudit({
    action: 'outlet.update',
    entity: 'Store',
    entityId: storeId,
    storeId,
    metadata: input,
  });
  return getClient(store.clientId ?? '');
}

// Apply a plan (and optionally a subscription state / trial) to ALL the client's
// outlets at once.
export async function applyPlanToClient(clientId: string, input: ApplyPlanInput) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw ApiError.notFound('Client not found');

  const data: Prisma.StoreUpdateManyMutationInput = { plan: input.planKey };
  if (input.subscriptionStatus !== undefined) data.subscriptionStatus = input.subscriptionStatus;
  if (input.trialDays !== undefined) {
    data.trialEndsAt =
      input.trialDays > 0 ? new Date(Date.now() + input.trialDays * 86_400_000) : null;
    if (input.subscriptionStatus === undefined) {
      data.subscriptionStatus = input.trialDays > 0 ? 'TRIALING' : 'ACTIVE';
    }
  }
  await prisma.store.updateMany({ where: { clientId }, data });
  await writeAudit({
    action: 'client.apply_plan',
    entity: 'Client',
    entityId: clientId,
    metadata: input,
  });
  return getClient(clientId);
}

// Issue a short-lived admin token scoped to an outlet so the operator can "view
// as" that restaurant. NOT a platform-admin token — storeId scopes every query
// to the outlet. Audited via the `imp` claim + a log line.
export async function impersonateOutlet(storeId: string, by: { id: string; email: string }) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true },
  });
  if (!store) throw ApiError.notFound('Outlet not found');
  // Prefer an existing admin of the outlet as the token identity; storeId is
  // what actually scopes the data, so fall back to the operator if there's none.
  const outletAdmin = await prisma.adminUser.findFirst({
    where: { storeId },
    select: { id: true, email: true },
  });
  const token = signAdminToken(
    {
      sub: outletAdmin?.id ?? by.id,
      email: outletAdmin?.email ?? by.email,
      storeId,
      isPlatformAdmin: false,
      imp: by.email,
    },
    { expiresIn: config.impersonationTtl },
  );
  logger.warn(
    { impersonator: by.email, storeId, outlet: store.name },
    'platform impersonation issued',
  );
  await writeAudit({
    action: 'outlet.impersonate',
    entity: 'Store',
    entityId: store.id,
    storeId: store.id,
    summary: `Impersonated outlet "${store.name}"`,
  });
  return { token, outlet: { id: store.id, name: store.name } };
}
