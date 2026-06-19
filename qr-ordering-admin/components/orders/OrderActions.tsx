"use client";

import { useState } from "react";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useOrderMutations } from "@/hooks/useOrderMutations";
import type { OrderStatus } from "@/lib/types";

interface OrderActionsProps {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  // "card" is compact; "detail" is larger for the detail page.
  variant?: "card" | "detail";
}

export function OrderActions({
  orderId,
  orderNumber,
  status,
  variant = "card",
}: OrderActionsProps) {
  const { setStatus, reprint } = useOrderMutations();
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Card actions sit on a single row inside the narrow order card, so they use
  // the compact size and each flexes to an equal third of the footer width.
  const size = variant === "detail" ? "lg" : "sm";
  const fill = variant === "card" ? "flex-1 min-w-0" : undefined;
  const isOpen = status === "NEW";
  const busy = setStatus.isPending || reprint.isPending;

  return (
    <>
      <Button
        variant="success"
        size={size}
        className={fill}
        disabled={!isOpen || busy}
        onClick={() => setStatus.mutate({ id: orderId, status: "COMPLETED" })}
      >
        <CheckCircle2 />
        Complete
      </Button>

      <Button
        variant="destructive"
        size={size}
        className={fill}
        disabled={!isOpen || busy}
        onClick={() => setConfirmCancel(true)}
      >
        <XCircle />
        Cancel
      </Button>

      <Button
        variant="secondary"
        size={size}
        className={fill}
        disabled={busy}
        onClick={() => reprint.mutate(orderId)}
      >
        <Printer />
        Reprint
      </Button>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel order #${orderNumber}?`}
        message="This will mark the order as cancelled. This cannot be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        busy={setStatus.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() =>
          setStatus.mutate(
            { id: orderId, status: "CANCELLED" },
            { onSuccess: () => setConfirmCancel(false) }
          )
        }
      />
    </>
  );
}
