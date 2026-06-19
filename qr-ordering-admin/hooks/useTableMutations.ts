"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tablesApi } from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import type { TableInput } from "@/lib/types";

// Mutations for the tables admin page. Mirrors useMenuMutations: invalidates the
// ["tables"] query and surfaces API errors (incl. 409 dup-code / delete-with-orders)
// through the toast.
export function useTableMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["floor"] });
  };

  const onError = (err: unknown) =>
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");

  const create = useMutation({
    mutationFn: (input: TableInput) => tablesApi.create(input),
    onSuccess: () => {
      invalidate();
      toast("Table created.", "success");
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TableInput> }) =>
      tablesApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast("Table updated.", "success");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => tablesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast("Table deleted.", "success");
    },
    onError,
  });

  return { create, update, remove };
}
