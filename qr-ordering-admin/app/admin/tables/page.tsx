"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableTile } from "@/components/tables/TableTile";
import { TableQrDialog } from "@/components/tables/TableQrDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { ordersApi, sessionsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { customerOrderLink } from "@/lib/customer";
import { copyToClipboard } from "@/lib/clipboard";
import { useFloorStream } from "@/hooks/useFloorStream";
import type { FloorEntry, FloorTable } from "@/lib/types";

// The live operational "Tables" view: a grid of tiles (free / occupied). Tap a
// free table to start an order, or an open tab to manage it. Table *setup*
// (add / edit / activate / delete) lives in Settings → Tables.
export default function TablesPage() {
  const router = useRouter();
  const { toast } = useToast();
  // Live floor via Server-Sent Events: each change pushes an instant refetch.
  useFloorStream();
  const query = useQuery({
    queryKey: ["floor"],
    queryFn: sessionsApi.floor,
    // SSE drives the live updates; this is just a fallback if the stream drops.
    refetchInterval: 30000,
  });
  // Kitchen-printing health — surfaces tickets that failed to print.
  const printHealth = useQuery({
    queryKey: ["print-health"],
    queryFn: ordersApi.printHealth,
    refetchInterval: 30000,
  });

  const [qrTable, setQrTable] = useState<FloorTable | null>(null);

  const entries = useMemo(() => query.data ?? [], [query.data]);

  // Occupied → open the running tab; free + active → start an order.
  const openEntry = (entry: FloorEntry) => {
    if (entry.session) {
      router.push(`/admin/sessions/${entry.session.id}`);
    } else if (entry.table.isActive) {
      router.push(`/admin/orders/new?table=${encodeURIComponent(entry.table.code)}`);
    }
  };

  const copyLink = async (t: FloorTable) => {
    if (await copyToClipboard(customerOrderLink(t.code))) {
      toast("Link copied to clipboard.", "success");
    } else {
      toast("Could not copy link.", "error");
    }
  };

  return (
    <>
      {printHealth.data && !printHealth.data.healthy && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          ⚠ Kitchen printing issue — {printHealth.data.counts.failedTerminal} ticket(s) failed to
          print
          {printHealth.data.counts.stuck > 0
            ? `, ${printHealth.data.counts.stuck} stuck`
            : ""}
          . Re-print the affected order(s) from the table history.
        </div>
      )}

      {query.isLoading ? (
        <LoadingState label="Loading tables…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError ? query.error.message : "Could not load the tables."
          }
          onRetry={() => query.refetch()}
        />
      ) : entries.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((entry) => (
            <TableTile
              key={entry.table.id}
              entry={entry}
              onOpen={() => openEntry(entry)}
              onQr={() => setQrTable(entry.table)}
              onCopy={() => copyLink(entry.table)}
              onHistory={() =>
                router.push(
                  `/admin/history?tableId=${entry.table.id}&table=${encodeURIComponent(entry.table.name)}`
                )
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tables yet"
          description="Add tables in Settings to generate their customer ordering links and QR codes."
          action={
            <Button onClick={() => router.push("/admin/settings/tables")}>
              <Settings2 />
              Manage tables
            </Button>
          }
        />
      )}

      {/* QR dialog */}
      <TableQrDialog table={qrTable} open={!!qrTable} onClose={() => setQrTable(null)} />
    </>
  );
}
