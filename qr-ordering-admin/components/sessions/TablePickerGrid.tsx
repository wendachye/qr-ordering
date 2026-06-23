"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { FloorEntry } from "@/lib/types";

// Floor-plan style table picker used by the Move / Combine dialogs. Shows every
// table as a tile; only valid targets are enabled (free for move, other open
// tabs for combine), the rest are dimmed so staff can still see the layout.
export function TablePickerGrid({
  entries,
  mode,
  currentSessionId,
  busy,
  onPick,
}: {
  entries: FloorEntry[];
  mode: "move" | "combine";
  currentSessionId: string;
  busy: boolean;
  onPick: (entry: FloorEntry) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {entries.map((e) => {
        const occupied = !!e.session;
        const isCurrent = e.session?.id === currentSessionId;
        const selectable =
          mode === "move"
            ? !occupied && e.table.isActive
            : occupied && !isCurrent;
        return (
          <Button
            key={e.table.id}
            variant="ghost"
            disabled={!selectable || busy}
            onClick={() => onPick(e)}
            className={cn(
              "flex h-auto min-h-[5.5rem] flex-col items-stretch justify-start whitespace-normal rounded-xl border p-3 text-left transition hover:bg-transparent",
              !selectable
                ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-55"
                : occupied
                  ? "border-accent-300 bg-accent-50/70 hover:border-accent-500 hover:shadow-md active:scale-[0.99]"
                  : "border-green-300 bg-white hover:border-accent-400 hover:bg-accent-50 hover:shadow-md active:scale-[0.99]"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  occupied
                    ? "bg-accent-500"
                    : e.table.isActive
                      ? "bg-green-500"
                      : "bg-slate-300"
                )}
                aria-hidden
              />
              <span className="truncate text-sm font-bold text-slate-900">
                {e.table.name}
              </span>
            </div>
            <div className="mt-auto pt-1.5">
              {isCurrent ? (
                <span className="text-xs font-semibold text-accent-600">
                  This tab
                </span>
              ) : occupied ? (
                <>
                  <p className="text-sm font-black leading-none text-slate-900">
                    {formatPrice(e.session!.total)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {e.session!.roundCount}{" "}
                    {e.session!.roundCount === 1 ? "round" : "rounds"}
                  </p>
                </>
              ) : e.table.isActive ? (
                <span className="text-xs font-semibold text-green-600">Free</span>
              ) : (
                <span className="text-xs font-medium text-slate-400">Inactive</span>
              )}
            </div>
          </Button>
        );
      })}
    </div>
  );
}
