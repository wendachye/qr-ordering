"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { categoriesApi, itemsApi, menuSettingsApi } from "@/lib/endpoints";
import {
  useCategoryMutations,
  useItemMutations,
  useRenameFeaturedTitle,
  useToggleFeaturedEnabled,
} from "@/hooks/useMenuMutations";
import { ApiError } from "@/lib/api";
import type { Category, MenuItem } from "@/lib/types";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";

type CategoryDialog = { mode: "create" } | { mode: "edit"; category: Category } | null;
type ItemDialog =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; item: MenuItem }
  | null;
type DeleteTarget =
  | { kind: "category"; category: Category }
  | { kind: "item"; item: MenuItem }
  | null;

export default function MenuBuilderPage() {
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: () => itemsApi.list() });
  const settingsQuery = useQuery({ queryKey: ["menu-settings"], queryFn: menuSettingsApi.get });

  const categoryMut = useCategoryMutations();
  const itemMut = useItemMutations();
  const { toast } = useToast();
  const { limits } = useEntitlements();

  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialog>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [moveTarget, setMoveTarget] = useState<MenuItem | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [tab, setTab] = useState("menu");
  const renameTitle = useRenameFeaturedTitle();
  const toggleFeatured = useToggleFeaturedEnabled();

  const categories = categoriesQuery.data ?? [];
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

  const deleteBusy = categoryMut.remove.isPending || itemMut.remove.isPending;
  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "category") {
      categoryMut.remove.mutate(deleteTarget.category.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    } else {
      itemMut.remove.mutate(deleteTarget.item.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Menu</h1>
          <p className="mt-1 text-slate-500">
            Your menu, the featured strip, and the customer-menu banner
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tab === "menu" && limits.maxMenuItems != null && (
            <span className="text-sm font-medium text-slate-500">
              {itemCount} / {limits.maxMenuItems} items
            </span>
          )}
          {tab === "menu" && categories.length > 0 && (
            <Button onClick={() => setCategoryDialog({ mode: "create" })}>
              <Plus />
              Add category
            </Button>
          )}
        </div>
      </div>

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
          <TabsList className="mb-4">
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="banner">Banner</TabsTrigger>
          </TabsList>

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

      {/* Delete confirm (category or item) */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.kind === "category" ? "Delete category?" : "Delete item?"}
        message={
          deleteTarget?.kind === "category"
            ? `Delete "${deleteTarget.category.name}"? A category with items can't be deleted — remove its items first.`
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
                  <button
                    key={c.id}
                    type="button"
                    disabled={itemMut.move.isPending}
                    onClick={() =>
                      itemMut.move.mutate(
                        { id: moveTarget.id, categoryId: c.id },
                        { onSuccess: () => setMoveTarget(null) }
                      )
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-base font-medium text-slate-800 transition-colors hover:border-accent-300 hover:bg-accent-50 disabled:opacity-50"
                  >
                    <span>{c.name}</span>
                    {!c.isActive && (
                      <span className="text-xs text-slate-400">Inactive</span>
                    )}
                  </button>
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
    </AdminShell>
  );
}
