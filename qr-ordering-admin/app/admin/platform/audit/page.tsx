"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { platformAuditApi } from "@/lib/endpoints";
import type { AuditEntry } from "@/lib/types";

const ACTIONS = [
  { value: "", label: "All actions" },
  { value: "client.create", label: "Client created" },
  { value: "client.update", label: "Client edited" },
  { value: "client.apply_plan", label: "Plan applied to client" },
  { value: "outlet.create", label: "Outlet added" },
  { value: "outlet.update", label: "Outlet edited" },
  { value: "outlet.impersonate", label: "Impersonation" },
  { value: "plan.update", label: "Plan edited" },
];

const PAGE = 50;

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionTone(action: string): "green" | "amber" | "gray" {
  if (action === "outlet.impersonate") return "amber";
  if (action.endsWith(".create")) return "green";
  return "gray";
}

export default function PlatformAuditPage() {
  const { user, status } = useAuth();
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["platform-audit", action, offset],
    queryFn: () => platformAuditApi.list({ action: action || undefined, limit: PAGE, offset }),
    enabled: !!user?.isPlatformAdmin,
  });

  if (status === "loading") {
    return (
      <AdminShell>
        <LoadingState label="Loading…" />
      </AdminShell>
    );
  }

  if (!user?.isPlatformAdmin) {
    return (
      <AdminShell>
        <Card>
          <CardContent>
            <h1 className="text-xl font-bold text-slate-900">Restricted</h1>
            <p className="mt-1 text-slate-500">The audit log is for the platform operator only.</p>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  const data = query.data;
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <ScrollText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Audit log</h1>
          <p className="text-slate-500">
            Every operator action across the platform — client &amp; plan edits and impersonation.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setOffset(0);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {query.isFetching && <span className="text-sm text-slate-400">Loading…</span>}
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading audit log…" />
      ) : query.isError ? (
        <ErrorState message="Could not load the audit log." onRetry={() => query.refetch()} />
      ) : entries.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-slate-500">No audit entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Operator</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
                    <th className="px-4 py-3 font-semibold">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <AuditRow key={e.id} entry={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + PAGE, total)}`} of {total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Next
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmt(entry.createdAt)}</td>
      <td className="px-4 py-3">
        <span className="font-medium text-slate-800">{entry.actorEmail}</span>
        {entry.actorImp && <span className="block text-xs text-amber-600">via {entry.actorImp}</span>}
      </td>
      <td className="px-4 py-3">
        <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
      </td>
      <td className="px-4 py-3 text-slate-600">
        {entry.summary ?? `${entry.entity}${entry.entityId ? ` · ${entry.entityId}` : ""}`}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
        {entry.ip ?? "—"}
      </td>
    </tr>
  );
}
