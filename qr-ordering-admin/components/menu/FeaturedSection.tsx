"use client";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { Star, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeaturedItemRow } from "@/components/menu/FeaturedItemRow";
import { useMenuSensors } from "@/hooks/useMenuSensors";
import { useReorderFeatured } from "@/hooks/useMenuMutations";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";

// The curated strip shown at the top of the customer menu. Items here keep
// their home category; this is a reference list ordered by featuredOrder.
export function FeaturedSection({
  items,
  title,
  enabled,
  onRename,
  onToggleEnabled,
  toggling,
}: {
  items: MenuItem[];
  title: string;
  // Master on/off for the strip on the customer menu (per-item ★ still applies).
  enabled: boolean;
  onRename: () => void;
  onToggleEnabled: () => void;
  toggling: boolean;
}) {
  const sensors = useMenuSensors();
  const reorder = useReorderFeatured();

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id))
    );
    reorder.mutate(next);
  };

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50/40">
      <CardContent className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <span className="text-sm text-slate-400">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRename}>
              <Pencil />
              Rename
            </Button>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              Show on menu
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Show the featured strip on the customer menu"
                disabled={toggling}
                onClick={onToggleEnabled}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  enabled ? "bg-accent-600" : "bg-slate-300",
                  toggling && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                    enabled ? "left-6" : "left-1"
                  )}
                />
              </button>
            </label>
          </div>
        </div>

        {!enabled && (
          <p className="mb-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">
            The featured strip is hidden from the customer menu. Turn “Show on menu” on to display it.
          </p>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amber-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Tap the ★ on any item below to feature it in this strip.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <FeaturedItemRow key={item.id} item={item} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
