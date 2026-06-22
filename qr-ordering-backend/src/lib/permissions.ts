import type { Role } from '@prisma/client';

// Coarse-grained permissions, mapped from a staff member's role. Keep the set
// small + action-oriented; gate routes with requirePermission(perm).
export type Permission =
  | 'staff:manage' // create / edit / deactivate staff accounts
  | 'settings:manage' // edit store settings + the override PIN
  | 'reports:view' // view the sales / Z-reading reports
  | 'menu:manage' // edit the menu, combos, vouchers, loyalty config
  | 'pos:operate' // take orders at the POS
  | 'payment:take' // settle / take payment on a tab
  | 'order:void'; // void items / cancel a tab

const MATRIX: Record<Role, Permission[]> = {
  OWNER: [
    'staff:manage',
    'settings:manage',
    'reports:view',
    'menu:manage',
    'pos:operate',
    'payment:take',
    'order:void',
  ],
  // Full operations + settings + staff (the staff service still stops a manager
  // from editing an OWNER, and only an OWNER can mint OWNER/MANAGER accounts).
  MANAGER: [
    'staff:manage',
    'settings:manage',
    'reports:view',
    'menu:manage',
    'pos:operate',
    'payment:take',
    'order:void',
  ],
  // Front-of-house cashier: runs the POS, settles bills, reads reports.
  CASHIER: ['reports:view', 'pos:operate', 'payment:take', 'order:void'],
  // Waiter: order entry only.
  WAITER: ['pos:operate'],
};

export function can(role: Role, perm: Permission): boolean {
  return MATRIX[role]?.includes(perm) ?? false;
}

// Roles a given actor is allowed to assign / manage. An OWNER manages everyone;
// a MANAGER can only manage CASHIER / WAITER (never OWNER or MANAGER).
export function manageableRoles(actor: Role): Role[] {
  if (actor === 'OWNER') return ['OWNER', 'MANAGER', 'CASHIER', 'WAITER'];
  if (actor === 'MANAGER') return ['CASHIER', 'WAITER'];
  return [];
}

export function canManageRole(actor: Role, target: Role): boolean {
  return manageableRoles(actor).includes(target);
}
