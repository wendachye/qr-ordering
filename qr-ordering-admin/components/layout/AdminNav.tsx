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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { outletsApi } from "@/lib/endpoints";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Top-level sections. "Menu" is now a single drag-and-drop builder page. Each
// item names the permission that reveals it (RBAC); Tables is always shown.
const MAIN_NAV: { href: string; label: string; icon: typeof LayoutGrid; perm?: Permission }[] = [
  { href: "/admin/tables", label: "Tables", icon: LayoutGrid },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, perm: "menu:manage" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, perm: "reports:view" },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone, perm: "menu:manage" },
  { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings:manage" },
];

// Platform operator (super-admin) sees a distinct console instead of a single
// restaurant's nav. (While impersonating, isPlatformAdmin is false → MAIN_NAV.)
const PLATFORM_NAV = [
  { href: "/platform/clients", label: "Clients", icon: Building2 },
  { href: "/platform/plans", label: "Plans", icon: Crown },
  { href: "/platform/audit", label: "Audit", icon: ScrollText },
];

// Paths in the live Tables flow (tiles, a session, per-table history, the POS) —
// keep "Tables" highlighted while drilled into any of them.
const TABLES_PATHS = [
  "/admin/tables",
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
        <Button
          variant="ghost"
          className="inline-flex h-auto items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          <Store className="h-4 w-4 text-slate-400" />
          <span className="max-w-[9rem] truncate">{current?.name ?? "Outlet"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
        </Button>
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

// The signed-in account, collapsed to a compact avatar that opens identity +
// sign-out. The email and role live inside the menu rather than inline, keeping
// the header short.
function AccountMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const label = user.name ?? user.email;
  const roleLabel = user.isPlatformAdmin
    ? "Platform admin"
    : user.role
      ? ROLE_LABELS[user.role]
      : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Account menu"
          className="h-auto rounded-full p-0 outline-none transition hover:bg-transparent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2"
        >
          <Avatar className="size-9">
            <AvatarFallback>{initials(label)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold text-slate-900">{label}</p>
          {/* Only when there's a real name above — otherwise the label already is the email. */}
          {user.name && (
            <p className="truncate text-xs font-normal text-slate-500">{user.email}</p>
          )}
          {roleLabel && (
            <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {roleLabel}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const inMenu = pathname.startsWith("/admin/menu");

  const mainActive = (href: string) => {
    if (href === "/admin/menu") return inMenu;
    if (href === "/admin/tables") return TABLES_PATHS.some((p) => pathname.startsWith(p));
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
          href={user?.isPlatformAdmin ? "/platform/clients" : "/admin/tables"}
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
          {(user?.isPlatformAdmin
            ? PLATFORM_NAV
            : MAIN_NAV.filter((item) => !item.perm || can(user?.role, item.perm))
          ).map((item) => {
            const Icon = item.icon;
            const active = user?.isPlatformAdmin
              ? pathname.startsWith(item.href)
              : mainActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-base font-semibold transition-colors lg:px-4",
                  active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <OutletSwitcher />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
