"use client";

import { Eye, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Outlet } from "@/lib/types";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  ACTIVE: "green",
  TRIALING: "amber",
  PAST_DUE: "amber",
  CANCELED: "red",
};

export function OutletRow({ outlet, onEdit }: { outlet: Outlet; onEdit: () => void }) {
  const { impersonate } = useAuth();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-slate-900">{outlet.name}</h3>
            <Badge tone="gray">{outlet.plan ?? "—"}</Badge>
            <Badge tone={STATUS_TONE[outlet.subscriptionStatus] ?? "gray"}>
              {outlet.subscriptionStatus}
            </Badge>
            {!outlet.isActive && <Badge tone="red">Suspended</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {outlet.tableCount} tables · {outlet.menuItemCount} items · {outlet.slug}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void impersonate(outlet.id, outlet.name)}>
            <Eye className="h-4 w-4" />
            View as
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Settings2 className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
