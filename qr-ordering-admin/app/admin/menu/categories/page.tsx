import { redirect } from "next/navigation";

// Categories were merged into the single Menu builder (/admin/menu).
export default function CategoriesRedirect() {
  redirect("/admin/menu");
}
