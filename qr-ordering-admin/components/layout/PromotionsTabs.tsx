"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sub-nav for the Promotions section. Vouchers today; the Loyalty admin UI slots
// in here as a second tab once it's built.
const TABS = [{ href: "/admin/promotions/vouchers", label: "Vouchers" }];

export function PromotionsTabs() {
  const pathname = usePathname();
  const active =
    [...TABS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((t) => pathname === t.href || pathname.startsWith(t.href + "/"))?.href ?? TABS[0].href;

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
