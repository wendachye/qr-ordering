import { Badge } from "@/components/ui/badge";
import type { OrderStatus, PrintStatus } from "@/lib/types";

const STATUS_TONE: Record<OrderStatus, "accent" | "green" | "gray"> = {
  NEW: "accent",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

const PRINT_TONE: Record<
  NonNullable<PrintStatus>,
  "amber" | "accent" | "green" | "red"
> = {
  PENDING: "amber",
  PRINTING: "accent",
  PRINTED: "green",
  FAILED: "red",
};

export function PrintStatusBadge({ status }: { status: PrintStatus }) {
  if (!status) return null;
  return (
    <Badge tone={PRINT_TONE[status]}>Print: {status}</Badge>
  );
}
