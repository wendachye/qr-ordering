"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

// A small "this is a Pro feature" prompt with a link to the billing page. Used
// to surface a locked entitlement before the staff member hits the backend 403.
export function UpgradeNotice({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">{title}</p>
          {children && <p className="mt-0.5 text-amber-800">{children}</p>}
          <Link
            href="/admin/billing"
            className="mt-1 inline-block font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            Upgrade plan →
          </Link>
        </div>
      </div>
    </div>
  );
}
