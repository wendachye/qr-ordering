"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tablesApi } from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// Large pill toggle for a table's Active/Inactive state (PATCH isActive).
// Mirrors the menu SoldOutToggle styling.
export function TableActiveToggle({
  tableId,
  isActive,
}: {
  tableId: string;
  isActive: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (next: boolean) => tablesApi.update(tableId, { isActive: next }),
    onSuccess: (table) => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast(
        table.isActive ? "Table activated." : "Table deactivated.",
        "success"
      );
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Update failed.", "error"),
  });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(!isActive)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
        isActive
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          isActive ? "bg-green-600" : "bg-slate-500"
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}
