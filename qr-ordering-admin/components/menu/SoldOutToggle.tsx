"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { itemsApi } from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

// A clear, large toggle for the item availability (sold-out) state.
export function SoldOutToggle({
  itemId,
  isAvailable,
}: {
  itemId: string;
  isAvailable: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (next: boolean) => itemsApi.setSoldOut(itemId, next),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast(
        item.isAvailable ? "Item marked available." : "Item marked sold out.",
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
      aria-checked={isAvailable}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(!isAvailable)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
        isAvailable
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-red-100 text-red-800 hover:bg-red-200"
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          isAvailable ? "bg-green-600" : "bg-red-600"
        )}
      />
      {isAvailable ? "Available" : "Sold out"}
    </button>
  );
}
