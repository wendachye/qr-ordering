"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ItemThumb } from "@/components/menu/ItemThumb";
import { FeatureToggle } from "@/components/menu/FeatureToggle";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

// A row in the featured strip. Shows the item's home category (since the strip
// spans categories) and a filled ★ that removes it. Drag to reorder the strip.
export function FeaturedItemRow({ item }: { item: MenuItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("border-slate-200", isDragging && "opacity-50")}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <Button
          variant="ghost"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${item.name}`}
          className="h-auto p-1 hover:bg-transparent touch-none cursor-grab rounded text-slate-300 hover:text-slate-500 active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical className="h-5 w-5" />
        </Button>

        <ItemThumb item={item} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{item.name}</p>
          <p className="text-xs text-slate-400">
            {item.categoryName}
            {!item.isAvailable && " · Sold out (hidden on menu)"}
          </p>
        </div>

        <span className="font-bold text-slate-900">{formatPrice(item.price)}</span>

        <FeatureToggle itemId={item.id} isFeatured={item.isFeatured} />
      </CardContent>
    </Card>
  );
}
