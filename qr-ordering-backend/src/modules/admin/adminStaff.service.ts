import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getDefaultStoreId } from '../../lib/store';
import { canManageRole } from '../../lib/permissions';
import type { CreateStaffInput, UpdateStaffInput } from '../../validators/staff';

type Actor = { id: string; role: Role };

const staffSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function listStaff() {
  const storeId = await getDefaultStoreId();
  return prisma.adminUser.findMany({
    where: { storeId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: staffSelect,
  });
}

export async function createStaff(actor: Actor, input: CreateStaffInput) {
  const storeId = await getDefaultStoreId();
  if (!canManageRole(actor.role, input.role)) {
    throw ApiError.forbidden(`You can't create a ${input.role} account`);
  }
  const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const password = await bcrypt.hash(input.password, 10);
  return prisma.adminUser.create({
    data: {
      storeId,
      email: input.email,
      password,
      name: input.name?.trim() || null,
      role: input.role,
    },
    select: staffSelect,
  });
}

export async function updateStaff(actor: Actor, id: string, input: UpdateStaffInput) {
  const storeId = await getDefaultStoreId();
  const target = await prisma.adminUser.findFirst({ where: { id, storeId } });
  if (!target) throw ApiError.notFound('Staff member not found');

  // You can only manage staff at/below your level — for the target's current role,
  // and (when reassigning) the new role too.
  if (!canManageRole(actor.role, target.role)) {
    throw ApiError.forbidden(`You can't manage a ${target.role} account`);
  }
  if (input.role && !canManageRole(actor.role, input.role)) {
    throw ApiError.forbidden(`You can't assign the ${input.role} role`);
  }

  // Don't let an admin lock themselves out.
  if (id === actor.id) {
    if (input.isActive === false) throw ApiError.badRequest("You can't deactivate your own account");
    if (input.role && input.role !== actor.role) {
      throw ApiError.badRequest("You can't change your own role");
    }
  }

  // The store must always keep at least one active owner.
  const losingOwner =
    target.role === 'OWNER' && ((input.role && input.role !== 'OWNER') || input.isActive === false);
  if (losingOwner) {
    const otherOwners = await prisma.adminUser.count({
      where: { storeId, role: 'OWNER', isActive: true, id: { not: id } },
    });
    if (otherOwners === 0) throw ApiError.badRequest('The store must keep at least one active owner');
  }

  return prisma.adminUser.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: staffSelect,
  });
}
