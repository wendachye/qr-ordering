"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { platformClientsApi } from "@/lib/endpoints";
import type { Client } from "@/lib/types";

export default function ClientsPage() {
  const q = useQuery({ queryKey: ["platform-clients"], queryFn: platformClientsApi.list });

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Clients</h1>
            <p className="text-slate-500">Every restaurant account on the platform and its outlets.</p>
          </div>
        </div>
        <Link href="/platform/clients/new">
          <Button>
            <Plus />
            New client
          </Button>
        </Link>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading clients…" />
      ) : q.isError ? (
        <ErrorState message="Could not load clients." onRetry={() => q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            No clients yet — create your first restaurant account.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {q.data!.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function planSummary(c: Client): string {
  const plans = [...new Set(c.outlets.map((o) => o.plan ?? "—"))];
  return plans.join(", ") || "—";
}

function ClientRow({ client }: { client: Client }) {
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
