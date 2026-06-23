import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";

// Persistent chrome for the platform (operator) console. Every /platform/* page
// is auth-gated, so the shell wraps them all unconditionally.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
