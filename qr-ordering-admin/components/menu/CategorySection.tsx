"use client";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  GripVertical,
  MoreVertical,
  Pencil,
  Power,
  ChevronDown,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableItemRow } from "@/components/menu/SortableItemRow";
import { useMenuSensors } from "@/hooks/useMenuSensors";
import { useReorderItems } from "@/hooks/useMenuMutations";
import { cn } from "@/lib/utils";
import type { Category, MenuItem } from "@/lib/types";

export function CategorySection({
  category,
  items,
  open,
  onToggleOpen,
  searching = false,
  onEditCategory,
  onToggleActive,
  onAddItem,
  onEditItem,
  onToggleItemActive,
  onMoveItem,
  onOutletOverrideItem,
  shared = false,
}: {
  category: Category;
  items: MenuItem[];
  open: boolean;
  onToggleOpen: () => void;
  // While a search is active, drag is disabled and the section stays expanded.
  searching?: boolean;
  onEditCategory: () => void;
  onToggleActive: () => void;
  onAddItem: () => void;
  onEditItem: (i: MenuItem) => void;
  onToggleItemActive: (i: MenuItem) => void;
  onMoveItem: (i: MenuItem) => void;
  // Per-outlet override on a shared catalogue (undefined / shared=false hides it).
  onOutletOverrideItem?: (i: MenuItem) => void;
  shared?: boolean;
}) {
  const sensors = useMenuSensors();
  const reorderItems = useReorderItems();

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleItemDragEnd = (e: DragEndEvent) => {
    if (searching) return; // reordering a filtered subset would corrupt the order
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id))
    );
    reorderItems.mutate({ categoryId: category.id, ids: next });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      id={`menu-cat-${category.id}`}
      className={cn("scroll-mt-4", isDragging && "opacity-50")}
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          {searching ? (
            <span aria-hidden className="w-7" />
          ) : (
            <Button
              variant="ghost"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Drag to reorder ${category.name}`}
              className="h-auto p-1 hover:bg-transparent touch-none cursor-grab rounded text-slate-300 hover:text-slate-500 active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GripVertical className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={onToggleOpen}
            disabled={searching}
            aria-label={open ? "Collapse category" : "Expand category"}
            aria-expanded={open}
            className="h-auto rounded p-1 text-slate-400 hover:bg-transparent hover:text-slate-700 disabled:opacity-40"
          >
            <ChevronDown
              className={cn("h-5 w-5 transition-transform", !open && "-rotate-90")}
            />
          </Button>

          <h2 className="text-lg font-bold text-slate-900">{category.name}</h2>
          {!category.isActive && <Badge tone="gray">Inactive</Badge>}
          <span className="text-sm text-slate-400">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onAddItem}>
              <Plus />
              Add item
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Manage ${category.name}`}>
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={onEditCategory}>
                  <Pencil />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleActive}>
                  <Power />
                  {category.isActive ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Body */}
        {open && (
          <div className="p-3">
            {items.length === 0 ? (
              <Button
                variant="ghost"
                onClick={onAddItem}
                className="flex h-auto w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-slate-400 transition-colors hover:bg-transparent hover:border-accent-300 hover:text-accent-600"
              >
                <Plus className="h-4 w-4" />
                Add the first item
              </Button>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleItemDragEnd}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((item) => (
                      <SortableItemRow
                        key={item.id}
                        item={item}
                        shared={shared}
                        disableDrag={searching}
                        onEdit={() => onEditItem(item)}
                        onToggleActive={() => onToggleItemActive(item)}
                        onMove={() => onMoveItem(item)}
                        onOutletOverride={
                          onOutletOverrideItem
                            ? () => onOutletOverrideItem(item)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
