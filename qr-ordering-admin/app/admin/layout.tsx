"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";

// Persistent chrome for the tenant admin: AdminNav + banners live here (in the
// layout) so they stay mounted across navigations instead of remounting on
// every page. Login is the only public page (tenants are created by the
// super-admin — there's no self-serve signup), so it renders bare — no shell,
// no auth guard (the guard would otherwise hide the login form).
const BARE_PATHS = ["/admin/login"];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (BARE_PATHS.includes(pathname)) return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
