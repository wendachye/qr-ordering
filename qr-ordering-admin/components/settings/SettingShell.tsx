"use client";

import type { ReactNode } from "react";

// Base card chrome shared by the inline-edit setting rows: an icon + title /
// subtitle on the left and an action slot (children) on the right.
export function SettingShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            {icon}
          </span>
          <div>
            <p className="font-bold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
