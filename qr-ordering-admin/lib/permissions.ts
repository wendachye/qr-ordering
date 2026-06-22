import type { Role } from "./types";

// Mirror of the backend role→permission matrix, used only to gate the UI (hide
// nav + actions). The backend is the real enforcement.
export type Permission =
  | "staff:manage"
  | "settings:manage"
  | "reports:view"
  | "menu:manage"
  | "pos:operate"
  | "payment:take"
  | "order:void";

const ALL: Permission[] = [
  "staff:manage",
  "settings:manage",
  "reports:view",
  "menu:manage",
  "pos:operate",
  "payment:take",
  "order:void",
];

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL,
  CASHIER: ["reports:view", "pos:operate", "payment:take", "order:void"],
  WAITER: ["pos:operate"],
};

// Undefined role (e.g. a platform operator on MAIN_NAV) → don't hide anything;
// the backend still enforces.
export function can(role: Role | undefined, perm: Permission): boolean {
  if (!role) return true;
  return MATRIX[role].includes(perm);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
};

export const ASSIGNABLE_ROLES: Record<Role, Role[]> = {
  OWNER: ["OWNER", "MANAGER", "CASHIER", "WAITER"],
  MANAGER: ["CASHIER", "WAITER"],
  CASHIER: [],
  WAITER: [],
};
