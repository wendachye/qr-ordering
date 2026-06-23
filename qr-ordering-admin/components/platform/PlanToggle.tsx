"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanKey } from "@/lib/types";

export function PlanToggle({ value, onChange }: { value: PlanKey; onChange: (v: PlanKey) => void }) {
  return (
    <div className="inline-flex h-10 rounded-lg border border-slate-200 p-0.5">
      {(["basic", "pro"] as PlanKey[]).map((p) => (
        <Button
          key={p}
          variant="ghost"
          onClick={() => onChange(p)}
          className={cn(
            "h-auto rounded-md px-4 py-0 text-sm font-semibold capitalize transition-colors hover:bg-transparent",
            value === p ? "bg-accent-600 text-white hover:bg-accent-600" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {p}
        </Button>
      ))}
    </div>
  );
}
