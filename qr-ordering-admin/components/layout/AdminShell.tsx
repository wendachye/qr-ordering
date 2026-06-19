"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AdminNav } from "./AdminNav";
import { BillingBanner } from "./BillingBanner";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { LoadingState } from "@/components/common/LoadingState";

// Wraps every protected /admin page: guards auth and renders the nav shell.
// Platform operators (not impersonating) are kept inside the /admin/platform
// console — they don't see a single restaurant's dashboard by default.
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, impersonating } = useAuth();

  const misplacedOperator =
    status === "authenticated" &&
    !!user?.isPlatformAdmin &&
    !impersonating &&
    !pathname.startsWith("/admin/platform");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
      return;
    }
    if (misplacedOperator) {
      router.replace("/admin/platform/clients");
    }
  }, [status, misplacedOperator, router]);

  if (status !== "authenticated" || misplacedOperator) {
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
      <BillingBanner />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
