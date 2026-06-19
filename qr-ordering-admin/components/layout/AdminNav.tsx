"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Check,
  ChevronsUpDown,
  Crown,
  LayoutGrid,
  LogOut,
  Megaphone,
  ScrollText,
  Settings,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/useAuth";
import { outletsApi } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Top-level sections. "Menu" is now a single drag-and-drop builder page.
const MAIN_NAV = [
  { href: "/admin/floor", label: "Tables", icon: LayoutGrid },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// Platform operator (super-admin) sees a distinct console instead of a single
// restaurant's nav. (While impersonating, isPlatformAdmin is false → MAIN_NAV.)
const PLATFORM_NAV = [
  { href: "/platform/clients", label: "Clients", icon: Building2 },
  { href: "/platform/plans", label: "Plans", icon: Crown },
  { href: "/platform/audit", label: "Audit", icon: ScrollText },
];

// Paths in the live floor flow (tiles, a session, per-table history, the POS) —
// keep "Floor" highlighted while drilled into any of them.
const FLOOR_PATHS = [
  "/admin/floor",
  "/admin/sessions",
  "/admin/history",
  "/admin/orders",
];

// A client owner whose client has more than one outlet can hop between them.
// Hidden for the platform operator and during impersonation.
function OutletSwitcher() {
  const { user, impersonating, switchOutlet } = useAuth();
  const enabled = !!user && !user.isPlatformAdmin && !impersonating;
  const { data } = useQuery({ queryKey: ["my-outlets"], queryFn: outletsApi.mine, enabled });
  if (!enabled || !data || data.outlets.length <= 1) return null;
  const current = data.outlets.find((o) => o.current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          <Store className="h-4 w-4 text-slate-400" />
          <span className="max-w-[9rem] truncate">{current?.name ?? "Outlet"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {data.clientName && (
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {data.clientName}
          </DropdownMenuLabel>
        )}
        {data.outlets.map((o) => (
          <DropdownMenuItem
            key={o.id}
            disabled={o.current}
            onSelect={() => {
              if (!o.current) void switchOutlet(o.id);
            }}
            className={o.current ? "font-semibold text-accent-700" : ""}
          >
            <Store className="h-4 w-4 text-slate-400" />
            <span className="flex-1 truncate">{o.name}</span>
            {o.current && <Check className="h-4 w-4 text-accent-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const inMenu = pathname.startsWith("/admin/menu");

  const mainActive = (href: string) => {
    if (href === "/admin/menu") return inMenu;
    if (href === "/admin/floor") return FLOOR_PATHS.some((p) => pathname.startsWith(p));
    // Billing lives under Settings (account area) — keep Settings lit on both.
    if (href === "/admin/settings")
      return pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/billing");
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
      {/* Top-level nav */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href={user?.isPlatformAdmin ? "/platform/clients" : "/admin/floor"}
          className="flex items-center gap-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600 text-lg font-black text-white">
            Q
          </span>
          <span className="hidden text-lg font-bold text-slate-900 sm:inline">
            QR Admin
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {(user?.isPlatformAdmin ? PLATFORM_NAV : MAIN_NAV).map((item) => {
            const Icon = item.icon;
            const active = user?.isPlatformAdmin
              ? pathname.startsWith(item.href)
              : mainActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-base font-semibold transition-colors",
                  active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <OutletSwitcher />
          {user && (
            <span className="hidden text-sm text-slate-500 md:inline">
              {user.name ?? user.email}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={logout}>
            <LogOut />
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
