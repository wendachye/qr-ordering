"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, GripVertical, MoreVertical, Pencil, Power, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SoldOutToggle } from "@/components/menu/SoldOutToggle";
import { FeatureToggle } from "@/components/menu/FeatureToggle";
import { ItemThumb } from "@/components/menu/ItemThumb";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export function SortableItemRow({
  item,
  onEdit,
  onToggleActive,
  onMove,
  onOutletOverride,
  shared = false,
  disableDrag = false,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggleActive: () => void;
  onMove: () => void;
  // Per-outlet override (shared catalogues only): open this outlet's price /
  // sold-out / offered-here editor for the item.
  onOutletOverride?: () => void;
  shared?: boolean;
  // While the list is filtered (search), reordering is meaningless — hide the
  // grip so the order can't be silently changed against the filtered subset.
  disableDrag?: boolean;
}) {
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
      className={cn(
        "border-slate-200",
        isDragging && "opacity-50",
        !item.isActive && "opacity-60",
      )}
    >
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        {/* Drag handle — listeners live ONLY here, and touch-none is scoped to it
            so the rest of the row stays tappable and the page still scrolls. */}
        {disableDrag ? (
          <span aria-hidden className="w-7" />
        ) : (
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
        )}

        <ItemThumb item={item} />

        <div className="min-w-[10rem] flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {item.name}
            {item.posOnly && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                Staff only
              </span>
            )}
            {!item.isActive && <Badge tone="gray">Inactive</Badge>}
            {shared && item.outletActive === false && (
              <Badge tone="gray">Hidden here</Badge>
            )}
            {shared && item.outletAvailable === false && <Badge tone="red">86 here</Badge>}
          </p>
          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
              {item.description}
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {item.salePrice != null && item.salePrice < item.price ? (
          <span className="flex items-center gap-1.5 whitespace-nowrap font-bold">
            <span className="text-red-600">{formatPrice(item.salePrice)}</span>
            <span className="text-xs font-medium text-slate-400 line-through">
              {formatPrice(item.price)}
            </span>
          </span>
        ) : (
          <span className="font-bold text-slate-900">{formatPrice(item.price)}</span>
        )}

        {shared && item.outletPrice != null && (
          <Badge tone="accent" title="This outlet's price">
            {formatPrice(item.outletPrice)} here
          </Badge>
        )}

        <FeatureToggle itemId={item.id} isFeatured={item.isFeatured} />

        <SoldOutToggle itemId={item.id} isAvailable={item.isAvailable} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Manage ${item.name}`}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMove}>
              <ArrowRightLeft />
              Move to category…
            </DropdownMenuItem>
            {shared && onOutletOverride && (
              <DropdownMenuItem onSelect={onOutletOverride}>
                <Store />
                Outlet override…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleActive}>
              <Power />
              {item.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
