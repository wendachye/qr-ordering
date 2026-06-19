import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { signAdminToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';

// The outlets a signed-in admin may switch between: every store under the SAME
// client as the admin's current store. A Client is one business account, so its
// outlets share an owner — switching never crosses into another client (tenant
// isolation holds). A store with no client just sees itself.
export async function listMyOutlets(currentStoreId: string) {
  const store = await prisma.store.findUnique({
    where: { id: currentStoreId },
    select: { id: true, name: true, clientId: true, client: { select: { name: true } } },
  });
  if (!store) throw ApiError.unauthorized('Store no longer exists');

  if (!store.clientId) {
    return {
      clientName: null,
      currentStoreId,
      outlets: [{ id: store.id, name: store.name, current: true }],
    };
  }

  const siblings = await prisma.store.findMany({
    where: { clientId: store.clientId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return {
    clientName: store.client?.name ?? null,
    currentStoreId,
    outlets: siblings.map((s) => ({ id: s.id, name: s.name, current: s.id === currentStoreId })),
  };
}

// Switch the signed-in admin to a sibling outlet. Mints a normal session token
// scoped to the target, adopting one of the target's admins as the identity (so
// /me + audit reflect the right account). Authorisation: the target MUST share
// the admin's client — you can never switch into another client's outlet.
export async function switchOutlet(
  current: { id: string; email: string; storeId: string },
  targetStoreId: string,
) {
  const [from, target] = await Promise.all([
    prisma.store.findUnique({ where: { id: current.storeId }, select: { clientId: true } }),
    prisma.store.findUnique({
      where: { id: targetStoreId },
      select: { id: true, name: true, clientId: true },
    }),
  ]);
  if (!from) throw ApiError.unauthorized('Store no longer exists');
  if (!target) throw ApiError.notFound('Outlet not found');
  if (!from.clientId || target.clientId !== from.clientId) {
    throw ApiError.forbidden('You can only switch to an outlet in your own group');
  }

  const targetAdmin = await prisma.adminUser.findFirst({
    where: { storeId: targetStoreId },
    select: { id: true, email: true },
  });
  const sub = targetAdmin?.id ?? current.id;
  const email = targetAdmin?.email ?? current.email;

  const token = signAdminToken({ sub, email, storeId: targetStoreId, isPlatformAdmin: false });
  logger.info({ from: current.email, to: email, storeId: targetStoreId }, 'outlet switch');
  return { token, outlet: { id: target.id, name: target.name } };
}
