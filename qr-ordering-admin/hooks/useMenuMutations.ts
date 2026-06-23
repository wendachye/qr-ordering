"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesApi,
  combosApi,
  inventoryApi,
  itemsApi,
  menuSettingsApi,
} from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import type {
  Category,
  CategoryInput,
  ComboInput,
  MenuItem,
  MenuItemInput,
} from "@/lib/types";

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["items"] });
  };

  const onError = (err: unknown) =>
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");

  const create = useMutation({
    mutationFn: (input: CategoryInput) => categoriesApi.create(input),
    onSuccess: () => {
      invalidate();
      toast("Category created.", "success");
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) =>
      categoriesApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast("Category updated.", "success");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast("Category deleted.", "success");
    },
    onError,
  });

  return { create, update, remove };
}

export function useItemMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const onError = (err: unknown) =>
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");

  const create = useMutation({
    mutationFn: (input: MenuItemInput) => itemsApi.create(input),
    onSuccess: () => {
      invalidate();
      toast("Item created.", "success");
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<MenuItemInput> }) =>
      itemsApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast("Item updated.", "success");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast("Item deleted.", "success");
    },
    onError,
  });

  // Move an item to another category (appends to the end there). The endpoint
  // returns the full item list, so we write it straight to cache.
  const move = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      itemsApi.move(id, categoryId),
    onSuccess: (serverItems) => {
      queryClient.setQueryData(["items"], serverItems);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast("Item moved.", "success");
    },
    onError,
  });

  return { create, update, remove, move };
}

export function useComboMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["combos"] });
  const onError = (err: unknown) =>
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");

  const create = useMutation({
    mutationFn: (input: ComboInput) => combosApi.create(input),
    onSuccess: () => {
      invalidate();
      toast("Combo created.", "success");
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ComboInput> }) =>
      combosApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast("Combo updated.", "success");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => combosApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast("Combo deleted.", "success");
    },
    onError,
  });

  return { create, update, remove };
}

export function useInventoryMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Stock changes flow through the items list (count + auto-86 availability).
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["items"] });
  const onError = (err: unknown) =>
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");

  const adjust = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { delta: number; reason: "restock" | "waste"; note?: string };
    }) => inventoryApi.adjust(id, input),
    onSuccess: (_res, { id, input }) => {
      invalidate();
      // Refresh the open dialog's "Recent movements" ledger too.
      queryClient.invalidateQueries({ queryKey: ["inventory-ledger", id] });
      toast(input.reason === "restock" ? "Stock added." : "Stock removed.", "success");
    },
    onError,
  });

  const config = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { trackStock?: boolean; stockQty?: number; lowStockThreshold?: number | null };
    }) => inventoryApi.config(id, input),
    onSuccess: (_res, { id }) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["inventory-ledger", id] });
      toast("Inventory updated.", "success");
    },
    onError,
  });

  return { adjust, config };
}

// --- Drag-and-drop reorder (optimistic) ---
// These are the app's only optimistic mutations: paint the new order instantly
// in onMutate, roll back on error, and write the server-returned order on success.
// We deliberately DO NOT invalidate (the QueryClient uses staleTime:0, so an
// invalidate would refetch and could snap the list back mid-interaction).

export function useReorderCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => categoriesApi.reorder(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previous = queryClient.getQueryData<Category[]>(["categories"]);
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]));
        const next = ids.map((id) => byId.get(id)).filter(Boolean) as Category[];
        queryClient.setQueryData<Category[]>(["categories"], next);
      }
      return { previous };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["categories"], ctx.previous);
      toast(err instanceof ApiError ? err.message : "Could not save order.", "error");
    },
    onSuccess: (serverList) => {
      queryClient.setQueryData(["categories"], serverList);
    },
  });
}

export function useReorderItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ ids }: { categoryId: string; ids: string[] }) => itemsApi.reorder(ids),
    onMutate: async ({ categoryId, ids }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<MenuItem[]>(["items"]);
      if (previous) {
        const inCat = new Map(
          previous.filter((i) => i.categoryId === categoryId).map((i) => [i.id, i])
        );
        const reordered = ids.map((id) => inCat.get(id)).filter(Boolean) as MenuItem[];
        // Substitute this category's items, in the new order, into their slots.
        let k = 0;
        const next = previous.map((i) =>
          i.categoryId === categoryId ? reordered[k++] ?? i : i
        );
        queryClient.setQueryData<MenuItem[]>(["items"], next);
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["items"], ctx.previous);
      toast(err instanceof ApiError ? err.message : "Could not save order.", "error");
    },
    onSuccess: (serverItems) => {
      queryClient.setQueryData(["items"], serverItems);
    },
  });
}

// Reorder the featured strip (optimistic, by featuredOrder, spans categories).
export function useReorderFeatured() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (ids: string[]) => itemsApi.reorderFeatured(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<MenuItem[]>(["items"]);
      if (previous) {
        const orderById = new Map(ids.map((id, idx) => [id, idx]));
        const next = previous.map((i) =>
          orderById.has(i.id) ? { ...i, featuredOrder: orderById.get(i.id)! } : i
        );
        queryClient.setQueryData<MenuItem[]>(["items"], next);
      }
      return { previous };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["items"], ctx.previous);
      toast(err instanceof ApiError ? err.message : "Could not save order.", "error");
    },
    onSuccess: (serverItems) => {
      queryClient.setQueryData(["items"], serverItems);
    },
  });
}

// Rename the featured section (store-level setting).
export function useRenameFeaturedTitle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (featuredTitle: string) => menuSettingsApi.update(featuredTitle),
    onSuccess: (settings) => {
      queryClient.setQueryData(["menu-settings"], settings);
      toast("Featured section renamed.", "success");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Rename failed.", "error"),
  });
}

// Master on/off for the customer-menu featured strip.
export function useToggleFeaturedEnabled() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (enabled: boolean) => menuSettingsApi.setFeaturedEnabled(enabled),
    onSuccess: (settings) => {
      queryClient.setQueryData(["menu-settings"], settings);
      toast(
        settings.featuredEnabled
          ? "Featured strip is shown on the customer menu."
          : "Featured strip is hidden from the customer menu.",
        "success"
      );
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Update failed.", "error"),
  });
}

// Save the customer-menu hero banner (image / title / subtitle).
export function useSaveBanner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: {
      bannerImageUrls?: string[];
      bannerTitle?: string | null;
      bannerSubtitle?: string | null;
    }) => menuSettingsApi.updateBanner(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(["menu-settings"], settings);
      toast("Menu banner saved.", "success");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Could not save the banner.", "error"),
  });
}

// Set the per-item takeaway packaging charge (store-level setting).
export function useSetTakeawayCharge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (takeawayCharge: number) =>
      menuSettingsApi.setTakeawayCharge(takeawayCharge),
    onSuccess: (settings) => {
      queryClient.setQueryData(["menu-settings"], settings);
      toast("Takeaway charge updated.", "success");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Update failed.", "error"),
  });
}
