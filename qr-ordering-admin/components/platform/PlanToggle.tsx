"use client";

import { cn } from "@/lib/utils";
import type { PlanKey } from "@/lib/types";

export function PlanToggle({ value, onChange }: { value: PlanKey; onChange: (v: PlanKey) => void }) {
  return (
    <div className="inline-flex h-10 rounded-lg border border-slate-200 p-0.5">
      {(["basic", "pro"] as PlanKey[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "rounded-md px-4 text-sm font-semibold capitalize transition-colors",
            value === p ? "bg-accent-600 text-white" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
