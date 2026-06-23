import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/types";

// Shared status tone mapping: draft gray, submitted amber, valid green,
// invalid red, cancelled gray.
const TONE: Record<InvoiceStatus, "gray" | "amber" | "green" | "red"> = {
  draft: "gray",
  submitted: "amber",
  valid: "green",
  invalid: "red",
  cancelled: "gray",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}
