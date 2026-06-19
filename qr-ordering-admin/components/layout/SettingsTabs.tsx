"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sub-nav for the account area: general store settings + billing. These are
// route-based tabs (each navigates to its own page), rendered with the shadcn
// Tabs primitives — the active value is derived from the current path, and each
// trigger is an actual <Link> (asChild) so navigation + prefetch stay native.
const TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/vouchers", label: "Vouchers" },
  { href: "/admin/billing", label: "Billing" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  // Pick the most specific (longest) matching href so a nested path like
  // /admin/settings/vouchers lights up Vouchers, not General.
  const active =
    [...TABS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((t) => pathname === t.href || pathname.startsWith(t.href + "/"))?.href ??
    TABS[0].href;

  return (
    <Tabs value={active} className="mb-6">
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.href} value={t.href} asChild>
            <Link href={t.href}>{t.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
