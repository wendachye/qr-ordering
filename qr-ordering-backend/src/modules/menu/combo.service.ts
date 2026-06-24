import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/response';
import { getCurrentCatalogueId, getDefaultStoreId } from '../../lib/store';
import type { CreateComboInput, UpdateComboInput } from '../../validators/combo';

const comboInclude = {
  groups: {
    orderBy: { sortOrder: 'asc' },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { menuItem: { select: { id: true, name: true, isAvailable: true } } },
      },
    },
  },
} satisfies Prisma.ComboInclude;

type ComboRow = Prisma.ComboGetPayload<{ include: typeof comboInclude }>;

export function toComboDto(c: ComboRow) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    imageUrls: c.imageUrls,
    price: Number(c.price),
    isAvailable: c.isAvailable,
    isActive: c.isActive,
    posOnly: c.posOnly,
    sortOrder: c.sortOrder,
    groups: c.groups.map((g) => ({
      id: g.id,
      name: g.name,
      options: g.options.map((o) => ({
        id: o.id,
        menuItemId: o.menuItemId,
        name: o.menuItem.name,
        priceDelta: Number(o.priceDelta),
        isAvailable: o.menuItem.isAvailable,
      })),
    })),
  };
}

async function assertItemsInStore(catalogueId: string, ids: string[]) {
  if (ids.length === 0) throw ApiError.badRequest('A combo needs at least one option');
  const count = await prisma.menuItem.count({ where: { id: { in: ids }, catalogueId } });
  if (count !== ids.length) throw ApiError.badRequest('Some combo options are not on this menu');
}

function groupsCreate(groups: NonNullable<CreateComboInput['groups']>) {
  return {
    create: groups.map((g, gi) => ({
      name: g.name.trim(),
      sortOrder: gi,
      options: {
        create: g.options.map((o, oi) => ({
          menuItemId: o.menuItemId,
          priceDelta: o.priceDelta ?? 0,
          sortOrder: oi,
        })),
      },
    })),
  };
}

const uniqueItemIds = (groups: CreateComboInput['groups']) => [
  ...new Set(groups.flatMap((g) => g.options.map((o) => o.menuItemId))),
];

export async function listCombos() {
  const catalogueId = await getCurrentCatalogueId();
  const combos = await prisma.combo.findMany({
    where: { catalogueId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: comboInclude,
  });
  return combos.map(toComboDto);
}

export async function createCombo(input: CreateComboInput) {
  const storeId = await getDefaultStoreId();
  const catalogueId = await getCurrentCatalogueId();
  await assertItemsInStore(catalogueId, uniqueItemIds(input.groups));
  const agg = await prisma.combo.aggregate({ where: { catalogueId }, _max: { sortOrder: true } });
  const combo = await prisma.combo.create({
    data: {
      storeId,
      catalogueId,
      name: input.name,
      description: input.description ?? null,
      imageUrls: input.imageUrls ?? [],
      price: input.price,
      isAvailable: input.isAvailable,
      isActive: input.isActive,
      posOnly: input.posOnly,
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
      groups: groupsCreate(input.groups),
    },
    include: comboInclude,
  });
  return toComboDto(combo);
}

export async function updateCombo(id: string, input: UpdateComboInput) {
  const catalogueId = await getCurrentCatalogueId();
  const existing = await prisma.combo.findFirst({
    where: { id, catalogueId },
    select: { id: true },
  });
  if (!existing) throw ApiError.notFound('Combo not found');
  if (input.groups) await assertItemsInStore(catalogueId, uniqueItemIds(input.groups));

  const combo = await prisma.$transaction(async (tx) => {
    // Groups are a full replace (drop + recreate) when provided.
    if (input.groups) await tx.comboGroup.deleteMany({ where: { comboId: id } });
    return tx.combo.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.imageUrls !== undefined ? { imageUrls: input.imageUrls } : {}),
        ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.posOnly !== undefined ? { posOnly: input.posOnly } : {}),
        ...(input.groups ? { groups: groupsCreate(input.groups) } : {}),
      },
      include: comboInclude,
    });
  });
  return toComboDto(combo);
}

// Combos are never destroyed — "delete" deactivates (isActive=false), hiding it
// from the customer menu + POS but keeping it. Reversible via updateCombo.
export async function deleteCombo(id: string) {
  const catalogueId = await getCurrentCatalogueId();
  const existing = await prisma.combo.findFirst({
    where: { id, catalogueId },
    select: { id: true },
  });
  if (!existing) throw ApiError.notFound('Combo not found');
  await prisma.combo.update({ where: { id }, data: { isActive: false } });
  return { id, deactivated: true };
}

/** Combos for the customer / POS menu. POS sees POS-only combos; both hide unavailable. */
export async function buildCombosForMenu(
  catalogueId: string | null,
  opts: { includePosOnly: boolean },
) {
  const combos = await prisma.combo.findMany({
    where: {
      catalogueId,
      isAvailable: true,
      isActive: true,
      ...(opts.includePosOnly ? {} : { posOnly: false }),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: comboInclude,
  });
  return combos.map(toComboDto);
}
