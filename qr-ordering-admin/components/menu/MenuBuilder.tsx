"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategorySection } from "@/components/menu/CategorySection";
import { useMenuSensors } from "@/components/menu/useMenuSensors";
import { useReorderCategories } from "@/hooks/useMenuMutations";
import type { Category, MenuItem } from "@/lib/types";

// Above this many items, the builder starts fully collapsed so a large menu
// isn't one endless scroll — the operator expands (or jumps to) a section.
const COLLAPSE_THRESHOLD = 24;

export function MenuBuilder({
  categories,
  itemsByCat,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onMoveItem,
  onEditCategory,
  onToggleActive,
  onDeleteCategory,
}: {
  categories: Category[];
  itemsByCat: Map<string, MenuItem[]>;
  onAddItem: (categoryId: string) => void;
  onEditItem: (i: MenuItem) => void;
  onDeleteItem: (i: MenuItem) => void;
  onMoveItem: (i: MenuItem) => void;
  onEditCategory: (c: Category) => void;
  onToggleActive: (c: Category) => void;
  onDeleteCategory: (c: Category) => void;
}) {
  const sensors = useMenuSensors();
  const reorderCategories = useReorderCategories();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const totalItems = useMemo(
    () => categories.reduce((s, c) => s + (itemsByCat.get(c.id)?.length ?? 0), 0),
    [categories, itemsByCat]
  );

  // Collapsed category ids. Large menus start fully collapsed.
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    totalItems > COLLAPSE_THRESHOLD ? new Set(categories.map((c) => c.id)) : new Set()
  );

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const filteredByCat = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const c of categories) {
      const items = itemsByCat.get(c.id) ?? [];
      m.set(c.id, q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items);
    }
    return m;
  }, [categories, itemsByCat, q]);

  const shownCategories = searching
    ? categories.filter((c) => (filteredByCat.get(c.id)?.length ?? 0) > 0)
    : categories;
  const matchCount = searching
    ? shownCategories.reduce((s, c) => s + (filteredByCat.get(c.id)?.length ?? 0), 0)
    : totalItems;

  const isOpen = (id: string) => searching || !collapsed.has(id);
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const collapseAll = () => setCollapsed(new Set(categories.map((c) => c.id)));
  const expandAll = () => setCollapsed(new Set());
  const allCollapsed = categories.length > 0 && categories.every((c) => collapsed.has(c.id));
  const jumpTo = (id: string) => {
    setCollapsed((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    requestAnimationFrame(() =>
      document
        .getElementById(`menu-cat-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (searching) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = categories.map((c) => c.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id))
    );
    reorderCategories.mutate(next);
  };

  const activeCategory = activeId ? categories.find((c) => c.id === activeId) : null;

  const list = (
    <div className="space-y-4">
      {shownCategories.map((cat) => (
        <CategorySection
          key={cat.id}
          category={cat}
          items={filteredByCat.get(cat.id) ?? []}
          open={isOpen(cat.id)}
          onToggleOpen={() => toggle(cat.id)}
          searching={searching}
          onEditCategory={() => onEditCategory(cat)}
          onToggleActive={() => onToggleActive(cat)}
          onDeleteCategory={() => onDeleteCategory(cat)}
          onAddItem={() => onAddItem(cat.id)}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
        />
      ))}
    </div>
  );

  return (
    <div>
      {/* Toolbar — search + collapse controls */}
      <div className="mb-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              aria-label="Search menu items"
              className="pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {!searching && categories.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (allCollapsed ? expandAll() : collapseAll())}
            >
              {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
              {allCollapsed ? "Expand all" : "Collapse all"}
            </Button>
          )}
        </div>

        {searching ? (
          <p className="text-sm text-slate-500">
            {matchCount} {matchCount === 1 ? "item" : "items"} match “{query}”
          </p>
        ) : (
          categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => jumpTo(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
                >
                  {c.name}
                  <span className="text-xs text-slate-400">
                    {itemsByCat.get(c.id)?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {searching && shownCategories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            No items match “{query}”.
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={(e: DragStartEvent) => {
            if (!searching) setActiveId(String(e.active.id));
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={shownCategories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {list}
          </SortableContext>

          {/* A clean snapshot of the dragged category (decoupled from collapse anims). */}
          <DragOverlay>
            {activeCategory ? (
              <Card className="shadow-xl ring-2 ring-accent-400">
                <CardContent className="flex items-center gap-2 p-3">
                  <span className="text-lg font-bold text-slate-900">
                    {activeCategory.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    {(itemsByCat.get(activeCategory.id) ?? []).length} items
                  </span>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
