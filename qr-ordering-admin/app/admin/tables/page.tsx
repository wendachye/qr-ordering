import { redirect } from "next/navigation";

// Tables were merged into the Floor view (each tile is a table + its open tab).
export default function TablesRedirect() {
  redirect("/admin/floor");
}
