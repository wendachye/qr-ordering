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
import { useMenuSensors } from "@/components/menu/useMenuSensors";
import { useReorderFeatured } from "@/hooks/useMenuMutations";
import type { MenuItem } from "@/lib/types";

// The curated strip shown at the top of the customer menu. Items here keep
// their home category; this is a reference list ordered by featuredOrder.
export function FeaturedSection({
  items,
  title,
  onRename,
}: {
  items: MenuItem[];
  title: string;
  onRename: () => void;
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
        <div className="mb-2 flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <span className="text-sm text-slate-400">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onRename}>
            <Pencil />
            Rename
          </Button>
        </div>

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
