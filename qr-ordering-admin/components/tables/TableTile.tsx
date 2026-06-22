"use client";

import { MoreHorizontal, QrCode, Link2, AlertTriangle, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDraftCount } from "@/hooks/useDraftCart";
import { cn } from "@/lib/utils";
import { formatPrice, formatRelative } from "@/lib/format";
import type { FloorEntry } from "@/lib/types";

// One tile on the live Tables grid. Free → tap to start an order; occupied →
// tap to open the running tab. The ⋯ menu (QR / link / history) is a sibling of
// the tap target so its clicks don't trigger navigation. Table setup lives in
// Settings → Tables.
export function TableTile({
  entry,
  onOpen,
  onQr,
  onCopy,
  onHistory,
}: {
  entry: FloorEntry;
  onOpen: () => void;
  onQr: () => void;
  onCopy: () => void;
  onHistory: () => void;
}) {
  const { table, session } = entry;
  const occupied = !!session;
  const interactive = occupied || table.isActive;
  // Unsent items parked on this table (saved locally, not yet sent). An occupied
  // tab keys its draft by session id; a free table's in-progress New order keys
  // by table code, so a half-built order shows here too.
  const unsent = useDraftCount(
    occupied ? session!.id : table.isActive ? `table:${table.code}` : ""
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={!interactive}
        className={cn(
          "flex min-h-[7.5rem] w-full flex-col rounded-2xl border p-4 text-left shadow-sm transition",
          occupied
            ? "border-accent-300 bg-accent-50/70 hover:border-accent-400 hover:shadow-md active:scale-[0.99]"
            : table.isActive
              ? "border-slate-200 bg-white hover:border-accent-300 hover:shadow-md active:scale-[0.99]"
              : "cursor-default border-slate-200 bg-white opacity-60"
        )}
      >
        <div className="flex items-center gap-2 pr-8">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              occupied ? "bg-accent-500" : table.isActive ? "bg-green-500" : "bg-slate-300"
            )}
            aria-hidden
          />
          <span className="truncate text-xl font-bold leading-tight text-slate-900">
            {table.name}
          </span>
          {session?.anyPrintFailed && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-label="Print failed" />
          )}
        </div>

        <div className="mt-auto pt-3">
          {occupied ? (
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-black leading-none text-slate-900">
                  {formatPrice(session!.total)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {session!.pax ? `${session!.pax} pax · ` : ""}
                  {formatRelative(session!.openedAt)}
                </p>
                {session!.amountPaid > 0 && session!.balanceDue > 0 && (
                  <p className="mt-1 text-xs font-bold text-amber-700">
                    Part-paid · {formatPrice(session!.balanceDue)} due
                  </p>
                )}
              </div>
              {unsent > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {unsent} unsent
                </span>
              )}
            </div>
          ) : table.isActive ? (
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-semibold text-accent-700">
                {unsent > 0 ? "Resume order" : "+ Start order"}
              </span>
              {unsent > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {unsent} unsent
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-slate-400">Inactive</span>
          )}
        </div>
      </button>

      {/* Manage menu — sits above the tap target */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Manage ${table.name}`}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onQr}>
            <QrCode />
            Show QR
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopy}>
            <Link2 />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onHistory}>
            <History />
            History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
