"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { AuditRow } from "@/components/platform/AuditRow";
import { useAuth } from "@/hooks/useAuth";
import { platformAuditApi } from "@/lib/endpoints";

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

// Radix Select forbids an empty-string item value; map the "All actions"
// sentinel to a non-empty token at the Select boundary only — the `action`
// state stays "" exactly as before.
const ALL = "__all__";

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
      <>
        <LoadingState label="Loading…" />
      </>
    );
  }

  if (!user?.isPlatformAdmin) {
    return (
      <>
        <Card>
          <CardContent>
            <h1 className="text-xl font-bold text-slate-900">Restricted</h1>
            <p className="mt-1 text-slate-500">The audit log is for the platform operator only.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const data = query.data;
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={action || ALL}
          onValueChange={(v) => {
            setAction(v === ALL ? "" : v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value || ALL}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                    <TableHead className="h-auto px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">When</TableHead>
                    <TableHead className="h-auto px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Operator</TableHead>
                    <TableHead className="h-auto px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</TableHead>
                    <TableHead className="h-auto px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Details</TableHead>
                    <TableHead className="h-auto px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <AuditRow key={e.id} entry={e} />
                  ))}
                </TableBody>
              </Table>
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
    </>
  );
}
