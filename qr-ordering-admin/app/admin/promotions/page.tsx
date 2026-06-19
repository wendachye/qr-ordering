import { redirect } from "next/navigation";

// The Promotions section opens on Vouchers (Loyalty will join as a second tab).
export default function PromotionsIndex() {
  redirect("/admin/promotions/vouchers");
}
