"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itemsApi } from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// Star toggle: add/remove an item from the featured strip. The endpoint returns
// the full item list, so we write it straight to cache (the Featured section
// re-derives from ["items"]).
export function FeatureToggle({
  itemId,
  isFeatured,
}: {
  itemId: string;
  isFeatured: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (next: boolean) => itemsApi.setFeatured(itemId, next),
    onSuccess: (items, next) => {
      queryClient.setQueryData(["items"], items);
      toast(next ? "Added to the featured strip." : "Removed from featured.", "success");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Update failed.", "error"),
  });

  return (
    <Button
      variant="ghost"
      aria-pressed={isFeatured}
      aria-label={isFeatured ? "Remove from featured" : "Feature this item"}
      title={isFeatured ? "Featured — tap to remove" : "Feature this item"}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(!isFeatured)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50",
        isFeatured
          ? "text-amber-500 hover:bg-amber-50"
          : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
      )}
    >
      <Star className={cn("h-5 w-5", isFeatured && "fill-amber-400")} />
    </Button>
  );
}
