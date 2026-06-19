"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import type { OrderStatus } from "@/lib/types";

// Centralised order mutations so OrderCard and the detail page share behaviour.
export function useOrderMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["order", id] });
  };

  const onError = (err: unknown) => {
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.setStatus(id, status),
    onSuccess: (order) => {
      invalidate(order.id);
      toast(
        order.status === "COMPLETED"
          ? "Order marked complete."
          : order.status === "CANCELLED"
            ? "Order cancelled."
            : "Order updated.",
        "success"
      );
    },
    onError,
  });

  const reprint = useMutation({
    mutationFn: (id: string) => ordersApi.reprint(id),
    onSuccess: (_data, id) => {
      invalidate(id);
      toast("Kitchen ticket reprint queued.", "success");
    },
    onError,
  });

  return { setStatus, reprint };
}
