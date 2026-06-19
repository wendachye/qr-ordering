import { redirect } from "next/navigation";

// The Orders module was merged into the Floor (live tabs) + History views.
export default function OrdersRedirect() {
  redirect("/admin/floor");
}
