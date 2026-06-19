"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AdminNav } from "./AdminNav";
import { BillingBanner } from "./BillingBanner";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { LoadingState } from "@/components/common/LoadingState";

// Two surfaces share this shell, on distinct URL paths:
//   • Client (tenant) admin / POS            → /admin/*
//   • Platform operator (super-admin) console → /platform/*
// An operator (when not impersonating) is kept on /platform; a tenant (or an
// operator who is impersonating an outlet) is kept off it. The billing/trial
// banner is a tenant concern and never shows on the operator console.
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, impersonating } = useAuth();

  const onOperatorPath = pathname.startsWith("/platform");
  const isOperator = !!user?.isPlatformAdmin && !impersonating;

  const misplacedOperator = status === "authenticated" && isOperator && !onOperatorPath;
  const misplacedTenant = status === "authenticated" && !isOperator && onOperatorPath;
  const misplaced = misplacedOperator || misplacedTenant;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
      return;
    }
    if (misplacedOperator) router.replace("/platform/clients");
    else if (misplacedTenant) router.replace("/admin/floor");
  }, [status, misplacedOperator, misplacedTenant, router]);

  if (status !== "authenticated" || misplaced) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminNav />
      <ImpersonationBanner />
      {/* Trial / billing banner is tenant-only — never on the operator console. */}
      {!isOperator && <BillingBanner />}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
