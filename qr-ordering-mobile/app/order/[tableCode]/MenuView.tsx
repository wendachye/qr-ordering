"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuItem, MenuResponse } from "@/lib/types";
import { ApiError, getMenu, getTable } from "@/lib/api";
import { useCartStore, selectSubtotal, selectTotalItems } from "@/store/cart";
import { MobileShell } from "@/components/layout/MobileShell";
import { MenuBanner } from "@/components/menu/MenuBanner";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { ItemModal, type AddSelection } from "@/components/menu/ItemModal";
import { StickyCartBar } from "@/components/cart/StickyCartBar";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; notFound: boolean }
  | { status: "ready"; data: MenuResponse };

// Synthetic category id for the "Popular"/featured tab — a virtual category
// whose items are the flagged ones (which also remain in their real categories).
const FEATURED_CATEGORY_ID = "__featured__";

export function MenuView({ tableCode }: { tableCode: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  // Cart store wiring.
  const setTable = useCartStore((s) => s.setTable);
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore(selectTotalItems);
  const subtotal = useCartStore(selectSubtotal);

  // Validate the table first (GET /public/tables/:tableCode), then load the
  // menu (GET /public/menu?tableCode=...). Validation surfaces a clear 404
  // (missing) / 400 (inactive) before we render the menu.
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      await getTable(tableCode);
      const data = await getMenu(tableCode);
      setState({ status: "ready", data });
      // Default to the "Popular" tab when there are featured items.
      setActiveCategory(
        data.featured && data.featured.length > 0
          ? FEATURED_CATEGORY_ID
          : data.categories[0]?.id ?? null
      );
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      const notFound = apiErr?.status === 404 || apiErr?.status === 400;
      setState({
        status: "error",
        message: apiErr?.message ?? "We couldn't load the menu. Please try again.",
        notFound,
      });
    }
  }, [tableCode]);

  useEffect(() => {
    // Point the cart at this table (resets cart if switching tables).
    setTable(tableCode);
    load();
  }, [tableCode, setTable, load]);

  // Map of menuItemId -> quantity, for the "in cart" badges.
  const quantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) map[i.menuItemId] = (map[i.menuItemId] ?? 0) + i.quantity;
    return map;
  }, [items]);

  const handleAdd = (item: MenuItem, selection: AddSelection) => {
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: selection.unitPrice,
      quantity: selection.quantity,
      note: selection.note.trim() ? selection.note.trim() : undefined,
      options: selection.options,
      optionChoiceIds: selection.optionChoiceIds,
    });
    setModalItem(null);
  };

  if (state.status === "loading") {
    return (
      <MobileShell>
        <LoadingState label="Loading menu..." />
      </MobileShell>
    );
  }

  if (state.status === "error") {
    return (
      <MobileShell>
        <ErrorState
          title={state.notFound ? "Table not found" : "Couldn't load menu"}
          message={
            state.notFound
              ? `We couldn't find an active table for "${tableCode}". Please rescan the QR code on your table.`
              : state.message
          }
          onRetry={state.notFound ? undefined : load}
        />
      </MobileShell>
    );
  }

  const { store, table, categories, featured, featuredTitle, banner } = state.data;

  // Surface "Popular" as the first category tab: a virtual category whose items
  // are the featured ones (which also still appear in their own categories).
  const displayCategories =
    featured && featured.length > 0
      ? [
          {
            id: FEATURED_CATEGORY_ID,
            name: featuredTitle ?? "Popular",
            sortOrder: -1,
            items: featured,
          },
          ...categories,
        ]
      : categories;
  const hasItems = displayCategories.some((c) => c.items.length > 0);
  const activeItems =
    displayCategories.find((c) => c.id === activeCategory)?.items ?? [];

  return (
    <MobileShell
      footer={
        <StickyCartBar tableCode={tableCode} itemCount={totalItems} subtotal={subtotal} />
      }
    >
      {/* Banner */}
      <MenuBanner
        storeName={store.name}
        tableName={table.name}
        imageUrls={banner?.imageUrls ?? []}
        title={banner?.title}
        subtitle={banner?.subtitle}
      />

      {/* Category selector — "Popular" is the first tab. Sticks to the top. */}
      {displayCategories.length > 0 && (
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
          <CategoryTabs
            categories={displayCategories}
            activeId={activeCategory}
            onSelect={setActiveCategory}
          />
        </div>
      )}

      {/* Items grid for the active category */}
      {!hasItems ? (
        <EmptyState
          title="No items yet"
          message="This menu doesn't have any items right now. Please check back soon."
        />
      ) : activeItems.length === 0 ? (
        <EmptyState
          title="Nothing in this category"
          message="Try another category from the bar above."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          {activeItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              quantityInCart={quantityById[item.id] ?? 0}
              onSelect={setModalItem}
            />
          ))}
        </div>
      )}

      <ItemModal item={modalItem} onClose={() => setModalItem(null)} onAdd={handleAdd} />
    </MobileShell>
  );
}
