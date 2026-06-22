"use client";

import { Users } from "lucide-react";

// Inline guest-count editor for the running tab. null → "Set pax"; otherwise a
// compact −/+ stepper. Each change persists immediately (optimistic).
export function PaxControl({
  pax,
  onChange,
  busy,
}: {
  pax: number | null;
  onChange: (n: number) => void;
  busy?: boolean;
}) {
  if (pax == null) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onChange(2)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-sm font-semibold text-slate-500 transition-colors hover:border-accent-300 hover:text-accent-700 disabled:opacity-50"
      >
        <Users className="h-4 w-4" />
        Set pax
      </button>
    );
  }
  const step = (delta: number, label: string, disabled: boolean) => (
    <button
      type="button"
      aria-label={delta > 0 ? "More guests" : "Fewer guests"}
      disabled={disabled}
      onClick={() => onChange(pax + delta)}
      className="flex h-6 w-6 items-center justify-center rounded-md text-lg font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
      <Users className="mr-0.5 h-4 w-4 text-slate-400" />
      {step(-1, "−", !!busy || pax <= 1)}
      <span className="w-6 text-center text-sm font-bold tabular-nums text-slate-800">
        {pax}
      </span>
      {step(1, "+", !!busy || pax >= 99)}
      <span className="ml-0.5 mr-1 text-xs font-medium text-slate-400">pax</span>
    </div>
  );
}
