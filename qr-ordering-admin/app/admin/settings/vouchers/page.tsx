import { redirect } from "next/navigation";

// Vouchers moved to its own top-level Promotions section. Keep this redirect so
// any old bookmarks / links still land in the right place.
export default function VouchersMoved() {
  redirect("/admin/promotions/vouchers");
}
