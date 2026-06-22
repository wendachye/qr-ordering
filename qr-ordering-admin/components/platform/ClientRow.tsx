"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@/lib/types";

function planSummary(c: Client): string {
  const plans = [...new Set(c.outlets.map((o) => o.plan ?? "—"))];
  return plans.join(", ") || "—";
}

export function ClientRow({ client }: { client: Client }) {
  return (
    <Link href={`/platform/clients/${client.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-slate-900">{client.name}</h2>
              {!client.isActive && <Badge tone="gray">Suspended</Badge>}
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {client.outletCount} {client.outletCount === 1 ? "outlet" : "outlets"} ·{" "}
              {planSummary(client)}
              {client.contactEmail ? ` · ${client.contactEmail}` : ""}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
        </CardContent>
      </Card>
    </Link>
  );
}
