"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuBuilder } from "@/components/menu/MenuBuilder";
import { FeaturedSection } from "@/components/menu/FeaturedSection";
import { BannerSettingsCard } from "@/components/menu/BannerSettingsCard";
import { CategoryForm } from "@/components/menu/CategoryForm";
import { MenuItemForm } from "@/components/menu/MenuItemForm";
import { ComboManager } from "@/components/menu/ComboManager";
import { ComboForm } from "@/components/menu/ComboForm";
import { InventoryManager } from "@/components/menu/InventoryManager";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { categoriesApi, combosApi, itemsApi, menuSettingsApi } from "@/lib/endpoints";
import {
  useCategoryMutations,
  useComboMutations,
  useItemMutations,
  useRenameFeaturedTitle,
  useToggleFeaturedEnabled,
} from "@/hooks/useMenuMutations";
import { ApiError } from "@/lib/api";
import type { Category, Combo, MenuItem } from "@/lib/types";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";

type CategoryDialog = { mode: "create" } | { mode: "edit"; category: Category } | null;
type ItemDialog =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; item: MenuItem }
  | null;
type ComboDialog = { mode: "create" } | { mode: "edit"; combo: Combo } | null;
type DeleteTarget =
  | { kind: "category"; category: Category }
  | { kind: "item"; item: MenuItem }
  | { kind: "combo"; combo: Combo }
  | null;

export default function MenuBuilderPage() {
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: () => itemsApi.list() });
  const settingsQuery = useQuery({ queryKey: ["menu-settings"], queryFn: menuSettingsApi.get });

  const combosQuery = useQuery({ queryKey: ["combos"], queryFn: combosApi.list });
  const categoryMut = useCategoryMutations();
  const itemMut = useItemMutations();
  const comboMut = useComboMutations();
  const { toast } = useToast();
  const { limits } = useEntitlements();

  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialog>(null);
  const [comboDialog, setComboDialog] = useState<ComboDialog>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [moveTarget, setMoveTarget] = useState<MenuItem | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [tab, setTab] = useState("menu");
  const renameTitle = useRenameFeaturedTitle();
  const toggleFeatured = useToggleFeaturedEnabled();

  const categories = categoriesQuery.data ?? [];
  const combos = combosQuery.data ?? [];
  const allItems = itemsQuery.data ?? [];
  const featuredTitle = settingsQuery.data?.featuredTitle ?? "Popular";
  const featuredEnabled = settingsQuery.data?.featuredEnabled ?? true;
  // Plan menu-item cap (null = unlimited).
  const itemCount = itemsQuery.data?.length ?? 0;
  const atItemLimit = limits.maxMenuItems != null && itemCount >= limits.maxMenuItems;

  // Featured strip = items flagged featured, in featuredOrder.
  const featured = useMemo(
    () =>
      (itemsQuery.data ?? [])
        .filter((i) => i.isFeatured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder),
    [itemsQuery.data]
  );

  const openRename = () => {
    setRenameValue(featuredTitle);
    setRenameOpen(true);
  };

  // Group items under their category. Items arrive sorted by sortOrder, so each
  // group preserves the drag order.
  const itemsByCat = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of itemsQuery.data ?? []) {
      const arr = m.get(it.categoryId) ?? [];
      arr.push(it);
      m.set(it.categoryId, arr);
    }
    return m;
  }, [itemsQuery.data]);

  const isLoading = categoriesQuery.isLoading || itemsQuery.isLoading;
  const isError = categoriesQuery.isError || itemsQuery.isError;
  const errorMsg =
    (categoriesQuery.error instanceof ApiError && categoriesQuery.error.message) ||
    (itemsQuery.error instanceof ApiError && itemsQuery.error.message) ||
    "Could not load the menu.";

  const deleteBusy =
    categoryMut.remove.isPending || itemMut.remove.isPending || comboMut.remove.isPending;
  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "category") {
      categoryMut.remove.mutate(deleteTarget.category.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    } else if (deleteTarget.kind === "combo") {
      comboMut.remove.mutate(deleteTarget.combo.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    } else {
      itemMut.remove.mutate(deleteTarget.item.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  return (
    <>
      {isLoading ? (
        <LoadingState label="Loading menu…" />
      ) : isError ? (
        <ErrorState
          message={errorMsg}
          onRetry={() => {
            categoriesQuery.refetch();
            itemsQuery.refetch();
          }}
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="menu">Menu</TabsTrigger>
              <TabsTrigger value="combos">Combos</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="featured">Featured</TabsTrigger>
              <TabsTrigger value="banner">Banner</TabsTrigger>
            </TabsList>
            {tab === "menu" && (
              <div className="flex items-center gap-3">
                {limits.maxMenuItems != null && (
                  <span className="text-sm font-medium text-slate-500">
                    {itemCount} / {limits.maxMenuItems} items
                  </span>
                )}
                {categories.length > 0 && (
                  <Button size="xs" onClick={() => setCategoryDialog({ mode: "create" })}>
                    <Plus />
                    Add category
                  </Button>
                )}
              </div>
            )}
            {tab === "combos" && combos.length > 0 && (
              <Button size="xs" onClick={() => setComboDialog({ mode: "create" })}>
                <Plus />
                Add combo
              </Button>
            )}
          </div>

          <TabsContent value="menu">
            {atItemLimit && (
              <UpgradeNotice
                className="mb-4"
                title={`You've reached your plan's ${limits.maxMenuItems}-item limit`}
              >
                Upgrade to add more menu items, or remove some you no longer serve.
              </UpgradeNotice>
            )}
            {categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create your first category, then add items to it."
                action={
                  <Button onClick={() => setCategoryDialog({ mode: "create" })}>
                    <Plus />
                    Add category
                  </Button>
                }
              />
            ) : (
              <MenuBuilder
                categories={categories}
                itemsByCat={itemsByCat}
                onAddItem={(categoryId) =>
                  atItemLimit
                    ? toast("Menu item limit reached — upgrade to add more.", "error")
                    : setItemDialog({ mode: "create", categoryId })
                }
                onEditItem={(item) => setItemDialog({ mode: "edit", item })}
                onDeleteItem={(item) => setDeleteTarget({ kind: "item", item })}
                onMoveItem={(item) => setMoveTarget(item)}
                onEditCategory={(category) => setCategoryDialog({ mode: "edit", category })}
                onToggleActive={(category) =>
                  categoryMut.update.mutate({
                    id: category.id,
                    input: { isActive: !category.isActive },
                  })
                }
                onDeleteCategory={(category) =>
                  setDeleteTarget({ kind: "category", category })
                }
              />
            )}
          </TabsContent>

          <TabsContent value="combos">
            {combosQuery.isLoading ? (
              <LoadingState label="Loading combos…" />
            ) : combosQuery.isError ? (
              <ErrorState
                message={
                  combosQuery.error instanceof ApiError
                    ? combosQuery.error.message
                    : "Could not load combos."
                }
                onRetry={() => combosQuery.refetch()}
              />
            ) : (
              <ComboManager
                combos={combos}
                onAdd={() => setComboDialog({ mode: "create" })}
                onEdit={(combo) => setComboDialog({ mode: "edit", combo })}
                onDelete={(combo) => setDeleteTarget({ kind: "combo", combo })}
              />
            )}
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryManager items={allItems} />
          </TabsContent>

          <TabsContent value="featured">
            <FeaturedSection
              items={featured}
              title={featuredTitle}
              enabled={featuredEnabled}
              onRename={openRename}
              onToggleEnabled={() => toggleFeatured.mutate(!featuredEnabled)}
              toggling={toggleFeatured.isPending}
            />
          </TabsContent>

          <TabsContent value="banner">
            {settingsQuery.data ? (
              <BannerSettingsCard settings={settingsQuery.data} />
            ) : (
              <LoadingState label="Loading banner…" />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Category add/edit */}
      <ModalDialog
        open={!!categoryDialog}
        onClose={() => setCategoryDialog(null)}
        title={categoryDialog?.mode === "edit" ? "Edit category" : "Add category"}
      >
        {categoryDialog && (
          <CategoryForm
            initial={categoryDialog.mode === "edit" ? categoryDialog.category : undefined}
            submitting={categoryMut.create.isPending || categoryMut.update.isPending}
            onCancel={() => setCategoryDialog(null)}
            onSubmit={(values) => {
              if (categoryDialog.mode === "edit") {
                categoryMut.update.mutate(
                  { id: categoryDialog.category.id, input: values },
                  { onSuccess: () => setCategoryDialog(null) }
                );
              } else {
                categoryMut.create.mutate(values, {
                  onSuccess: () => setCategoryDialog(null),
                });
              }
            }}
          />
        )}
      </ModalDialog>

      {/* Item add/edit */}
      <ModalDialog
        open={!!itemDialog}
        onClose={() => setItemDialog(null)}
        title={itemDialog?.mode === "edit" ? "Edit item" : "Add item"}
        className="sm:max-w-3xl"
      >
        {itemDialog && (
          <MenuItemForm
            initial={itemDialog.mode === "edit" ? itemDialog.item : undefined}
            categories={categories}
            defaultCategoryId={itemDialog.mode === "create" ? itemDialog.categoryId : undefined}
            submitting={itemMut.create.isPending || itemMut.update.isPending}
            onCancel={() => setItemDialog(null)}
            onSubmit={(values) => {
              if (itemDialog.mode === "edit") {
                itemMut.update.mutate(
                  { id: itemDialog.item.id, input: values },
                  { onSuccess: () => setItemDialog(null) }
                );
              } else {
                itemMut.create.mutate(values, { onSuccess: () => setItemDialog(null) });
              }
            }}
          />
        )}
      </ModalDialog>

      {/* Combo add/edit */}
      <ModalDialog
        open={!!comboDialog}
        onClose={() => setComboDialog(null)}
        title={comboDialog?.mode === "edit" ? "Edit combo" : "Add combo"}
        className="sm:max-w-3xl"
      >
        {comboDialog && (
          <ComboForm
            initial={comboDialog.mode === "edit" ? comboDialog.combo : undefined}
            items={allItems}
            submitting={comboMut.create.isPending || comboMut.update.isPending}
            onCancel={() => setComboDialog(null)}
            onSubmit={(values) => {
              if (comboDialog.mode === "edit") {
                comboMut.update.mutate(
                  { id: comboDialog.combo.id, input: values },
                  { onSuccess: () => setComboDialog(null) }
                );
              } else {
                comboMut.create.mutate(values, { onSuccess: () => setComboDialog(null) });
              }
            }}
          />
        )}
      </ModalDialog>

      {/* Delete confirm (category, item or combo) */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={
          deleteTarget?.kind === "category"
            ? "Delete category?"
            : deleteTarget?.kind === "combo"
              ? "Delete combo?"
              : "Delete item?"
        }
        message={
          deleteTarget?.kind === "category"
            ? `Delete "${deleteTarget.category.name}"? A category with items can't be deleted — remove its items first.`
            : deleteTarget?.kind === "combo"
              ? `Delete the "${deleteTarget.combo.name}" combo? This can't be undone.`
              : deleteTarget?.kind === "item"
                ? `Delete "${deleteTarget.item.name}"? Items referenced by past orders can't be deleted (mark them sold out instead).`
                : ""
        }
        confirmLabel="Delete"
        destructive
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* Move item to another category */}
      <ModalDialog
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title="Move to category"
      >
        {moveTarget && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              Move <span className="font-semibold text-slate-700">{moveTarget.name}</span>{" "}
              to the end of:
            </p>
            {categories.filter((c) => c.id !== moveTarget.categoryId).length === 0 ? (
              <p className="py-4 text-center text-slate-400">
                No other categories to move to.
              </p>
            ) : (
              categories
                .filter((c) => c.id !== moveTarget.categoryId)
                .map((c) => (
                  <Button
                    key={c.id}
                    variant="ghost"
                    disabled={itemMut.move.isPending}
                    onClick={() =>
                      itemMut.move.mutate(
                        { id: moveTarget.id, categoryId: c.id },
                        { onSuccess: () => setMoveTarget(null) }
                      )
                    }
                    className="h-auto whitespace-normal flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-base font-medium text-slate-800 transition-colors hover:border-accent-300 hover:bg-accent-50 disabled:opacity-50"
                  >
                    <span>{c.name}</span>
                    {!c.isActive && (
                      <span className="text-xs text-slate-400">Inactive</span>
                    )}
                  </Button>
                ))
            )}
          </div>
        )}
      </ModalDialog>

      {/* Rename the featured section */}
      <ModalDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename featured section"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = renameValue.trim();
            if (!v) return;
            renameTitle.mutate(v, { onSuccess: () => setRenameOpen(false) });
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="featured-title">Section title</Label>
            <Input
              id="featured-title"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="e.g. Popular, Chef's picks"
              maxLength={40}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRenameOpen(false)}
              disabled={renameTitle.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={renameTitle.isPending || !renameValue.trim()}>
              {renameTitle.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
