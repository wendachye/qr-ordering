"use client";

import { Pencil, Plus, Power, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { assetUrl } from "@/lib/assets";
import type { Combo } from "@/lib/types";

// The list of set meals / combos. Each combo bundles menu items into a fixed
// base price; the diner picks one option per group.
export function ComboManager({
  combos,
  onAdd,
  onEdit,
  onToggleActive,
}: {
  combos: Combo[];
  onAdd: () => void;
  onEdit: (c: Combo) => void;
  onToggleActive: (c: Combo) => void;
}) {
  if (combos.length === 0) {
    return (
      <EmptyState
        title="No combos yet"
        description="Bundle menu items into a set meal at a fixed price — diners pick one option per group."
        action={
          <Button onClick={onAdd}>
            <Plus />
            Add combo
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {combos.map((c) => {
        const picks = c.groups.map((g) => g.name).join(" · ");
        return (
          <Card key={c.id} className={c.isAvailable && c.isActive ? "" : "opacity-60"}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {c.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetUrl(c.imageUrls[0])}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <UtensilsCrossed className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    <span className="truncate">{c.name}</span>
                    {!c.isActive && <Badge tone="gray">Inactive</Badge>}
                    {!c.isAvailable && <Badge tone="gray">Sold out</Badge>}
                    {c.posOnly && <Badge tone="amber">POS only</Badge>}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    RM {c.price.toFixed(2)} · {c.groups.length}{" "}
                    {c.groups.length === 1 ? "choice" : "choices"}
                    {picks ? ` · ${picks}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(c)}
                  aria-label={`Edit ${c.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleActive(c)}
                  aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
                  className="text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Power className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
