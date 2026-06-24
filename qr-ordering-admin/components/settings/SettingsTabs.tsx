"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sub-nav for the account area: general store settings + billing. These are
// route-based tabs (each navigates to its own page), rendered with the shadcn
// Tabs primitives — the active value is derived from the current path, and each
// trigger is an actual <Link> (asChild) so navigation + prefetch stay native.
const TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/charges", label: "Charges" },
  { href: "/admin/settings/staff", label: "Staff" },
  { href: "/admin/settings/security", label: "Security" },
  { href: "/admin/settings/einvoice", label: "e-Invoice" },
  { href: "/admin/settings/tables", label: "Tables" },
  { href: "/admin/billing", label: "Billing" },
];

export function SettingsTabs({ action }: { action?: ReactNode }) {
  const pathname = usePathname();
  // Pick the most specific (longest) matching href so a nested path like
  // /admin/settings/vouchers lights up Vouchers, not General.
  const active =
    [...TABS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((t) => pathname === t.href || pathname.startsWith(t.href + "/"))?.href ??
    TABS[0].href;

  // Tabs on the left; an optional page action (e.g. "Add table") on the right.
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Tabs value={active}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.href} value={t.href} asChild>
              <Link href={t.href}>{t.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {action}
    </div>
  );
}
