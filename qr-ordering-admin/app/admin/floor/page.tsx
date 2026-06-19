"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { FloorTile } from "@/components/floor/FloorTile";
import { TableForm } from "@/components/tables/TableForm";
import { TableQrDialog } from "@/components/tables/TableQrDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { ordersApi, sessionsApi } from "@/lib/endpoints";
import { useTableMutations } from "@/hooks/useTableMutations";
import { ApiError } from "@/lib/api";
import { customerOrderLink } from "@/lib/customer";
import { copyToClipboard } from "@/lib/clipboard";
import type { FloorEntry, FloorTable } from "@/lib/types";

export default function FloorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const query = useQuery({
    queryKey: ["floor"],
    queryFn: sessionsApi.floor,
    refetchInterval: 5000, // live floor; poll like the old orders list
  });
  // Kitchen-printing health — surfaces tickets that failed to print.
  const printHealth = useQuery({
    queryKey: ["print-health"],
    queryFn: ordersApi.printHealth,
    refetchInterval: 20000,
  });
  const { create, update, remove } = useTableMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FloorTable | null>(null);
  const [deleting, setDeleting] = useState<FloorTable | null>(null);
  const [qrTable, setQrTable] = useState<FloorTable | null>(null);

  const entries = useMemo(() => query.data ?? [], [query.data]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: FloorTable) => {
    setEditing(t);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

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
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Floor</h1>
          <p className="mt-1 text-slate-500">
            Tap a free table to start an order, or an open tab to manage it
            {query.isFetching && !query.isLoading && " · updating…"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add table
        </Button>
      </div>

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
        <LoadingState label="Loading floor…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError ? query.error.message : "Could not load the floor."
          }
          onRetry={() => query.refetch()}
        />
      ) : entries.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((entry) => (
            <FloorTile
              key={entry.table.id}
              entry={entry}
              onOpen={() => openEntry(entry)}
              onQr={() => setQrTable(entry.table)}
              onCopy={() => copyLink(entry.table)}
              onEdit={() => openEdit(entry.table)}
              onToggle={() =>
                update.mutate({
                  id: entry.table.id,
                  input: { isActive: !entry.table.isActive },
                })
              }
              onDelete={() => setDeleting(entry.table)}
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
          description="Add your first table to generate its customer ordering link and QR."
          action={
            <Button onClick={openCreate}>
              <Plus />
              Add table
            </Button>
          }
        />
      )}

      {/* Add / edit dialog */}
      <ModalDialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit table" : "Add table"}
      >
        <TableForm
          key={editing?.code ?? "new"}
          initial={editing ?? undefined}
          submitting={create.isPending || update.isPending}
          onCancel={closeForm}
          onSubmit={(values) => {
            if (editing) {
              update.mutate(
                { id: editing.id, input: values },
                { onSuccess: closeForm }
              );
            } else {
              create.mutate(values, { onSuccess: closeForm });
            }
          }}
        />
      </ModalDialog>

      {/* QR dialog */}
      <TableQrDialog table={qrTable} open={!!qrTable} onClose={() => setQrTable(null)} />

      {/* Delete confirm — surfaces the 409 (table has history) via the toast on error */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete table?"
        message={
          deleting
            ? `Delete "${deleting.name}" (${deleting.code})? A table that already has orders or sessions cannot be deleted — deactivate it instead.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </AdminShell>
  );
}
