"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuItem, MenuResponse, PublicCombo } from "@/lib/types";
import { ApiError, getMenu, getTable } from "@/lib/api";
import { useCartStore, selectSubtotal, selectTotalItems } from "@/store/cart";
import { MobileShell } from "@/components/layout/MobileShell";
import { MenuBanner } from "@/components/menu/MenuBanner";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { ComboCard } from "@/components/menu/ComboCard";
import { ItemModal, type AddSelection } from "@/components/menu/ItemModal";
import { ComboModal, type AddComboSelection } from "@/components/menu/ComboModal";
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
// Synthetic category id for the "Set meals"/combos tab.
const COMBOS_CATEGORY_ID = "__combos__";

export function MenuView({ tableCode }: { tableCode: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalCombo, setModalCombo] = useState<PublicCombo | null>(null);

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
      // Default tab: "Popular" if featured, else "Set meals" if there are
      // orderable combos, else the first real category.
      const hasCombos = (data.combos ?? []).some(
        (c) => c.isAvailable && !c.posOnly
      );
      setActiveCategory(
        data.featured && data.featured.length > 0
          ? FEATURED_CATEGORY_ID
          : hasCombos
          ? COMBOS_CATEGORY_ID
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

  // Map of menuItemId -> quantity, for the "in cart" badges (item lines only).
  const quantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) {
      if (i.kind === "item") map[i.menuItemId] = (map[i.menuItemId] ?? 0) + i.quantity;
    }
    return map;
  }, [items]);

  // Map of comboId -> quantity, for the combo cards' "in cart" badges.
  const comboQuantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) {
      if (i.kind === "combo") map[i.comboId] = (map[i.comboId] ?? 0) + i.quantity;
    }
    return map;
  }, [items]);

  const handleAdd = (item: MenuItem, selection: AddSelection) => {
    addItem({
      kind: "item",
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

  const handleAddCombo = (combo: PublicCombo, selection: AddComboSelection) => {
    addItem({
      kind: "combo",
      comboId: combo.id,
      name: combo.name,
      price: selection.unitPrice,
      quantity: selection.quantity,
      note: selection.note.trim() ? selection.note.trim() : undefined,
      picks: selection.picks,
    });
    setModalCombo(null);
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

  const { store, table, categories, combos, featured, featuredTitle, banner } =
    state.data;

  // Available combos / set meals (guard out unavailable + POS-only ones).
  const availableCombos = (combos ?? []).filter(
    (c) => c.isAvailable && !c.posOnly
  );

  // Surface "Popular" (featured) and "Set meals" (combos) as the first tabs:
  // virtual categories near the top. The combos tab carries no `items` (combos
  // render separately); CategoryTabs only reads `id` + `name`.
  const displayCategories = [
    ...(featured && featured.length > 0
      ? [
          {
            id: FEATURED_CATEGORY_ID,
            name: featuredTitle ?? "Popular",
            sortOrder: -2,
            items: featured,
          },
        ]
      : []),
    ...(availableCombos.length > 0
      ? [
          {
            id: COMBOS_CATEGORY_ID,
            name: "Set meals",
            sortOrder: -1,
            items: [],
          },
        ]
      : []),
    ...categories,
  ];
  const showingCombos = activeCategory === COMBOS_CATEGORY_ID;
  const hasItems =
    availableCombos.length > 0 || displayCategories.some((c) => c.items.length > 0);
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
        logoUrl={store.logoUrl}
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

      {/* Items grid for the active category (combo cards on the "Set meals" tab) */}
      {!hasItems ? (
        <EmptyState
          title="No items yet"
          message="This menu doesn't have any items right now. Please check back soon."
        />
      ) : showingCombos ? (
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          {availableCombos.map((combo) => (
            <ComboCard
              key={combo.id}
              combo={combo}
              quantityInCart={comboQuantityById[combo.id] ?? 0}
              onSelect={setModalCombo}
            />
          ))}
        </div>
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
      <ComboModal
        combo={modalCombo}
        onClose={() => setModalCombo(null)}
        onAdd={handleAddCombo}
      />
    </MobileShell>
  );
}
