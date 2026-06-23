"use client";

import { Eye, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

// Top banner shown while the platform operator is "viewing as" an outlet.
export function ImpersonationBanner() {
  const { user, impersonating, exitImpersonation } = useAuth();
  if (!impersonating) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white print:hidden">
      <Eye className="h-4 w-4" />
      <span>
        Viewing <span className="font-black">{impersonating.outletName}</span> as the operator
        {user?.imp ? ` (${user.imp})` : ""}
      </span>
      <Button
        variant="ghost"
        onClick={() => void exitImpersonation()}
        className="ml-2 inline-flex h-auto items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 font-bold text-white transition-colors hover:bg-white/30 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" />
        Exit
      </Button>
    </div>
  );
}
