import { redirect } from "next/navigation";

// Items were merged into the single Menu builder (/admin/menu).
export default function ItemsRedirect() {
  redirect("/admin/menu");
}
