"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { TableForm } from "@/components/tables/TableForm";
import { TableQrDialog } from "@/components/tables/TableQrDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";
import { useToast } from "@/components/common/Toast";
import { tablesApi } from "@/lib/endpoints";
import { useTableMutations } from "@/hooks/useTableMutations";
import { useEntitlements } from "@/hooks/useEntitlements";
import { ApiError } from "@/lib/api";
import { customerOrderLink } from "@/lib/customer";
import { copyToClipboard } from "@/lib/clipboard";
import type { Table } from "@/lib/types";

// Settings → Tables: set up the restaurant's tables (add / rename / activate /
// delete) and their QR ordering links. The live operational view lives on the
// Tables screen (/admin/tables); this is the configuration surface.
export default function SettingsTablesPage() {
  const { toast } = useToast();
  const query = useQuery({ queryKey: ["tables"], queryFn: tablesApi.list });
  const { create, update, remove } = useTableMutations();
  const { limits } = useEntitlements();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [deleting, setDeleting] = useState<Table | null>(null);
  const [qrTable, setQrTable] = useState<Table | null>(null);

  const tables = query.data ?? [];
  const atLimit = limits.maxTables != null && tables.length >= limits.maxTables;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

  const copyLink = async (t: Table) => {
    if (await copyToClipboard(customerOrderLink(t.code))) {
      toast("Link copied to clipboard.", "success");
    } else {
      toast("Could not copy link.", "error");
    }
  };

  return (
    <>
      <SettingsTabs
        action={
          <div className="flex items-center gap-3">
            {limits.maxTables != null && (
              <span className="text-sm font-medium text-slate-500">
                {tables.length} / {limits.maxTables} tables
              </span>
            )}
            {tables.length > 0 && (
              <Button
                size="xs"
                onClick={openCreate}
                disabled={atLimit}
                title={atLimit ? "Table limit reached — upgrade for more" : undefined}
              >
                <Plus />
                Add table
              </Button>
            )}
          </div>
        }
      />

      {atLimit && (
        <UpgradeNotice
          className="mb-4"
          title={`You've reached your plan's ${limits.maxTables}-table limit`}
        >
          Upgrade to add more tables, or delete an unused one.
        </UpgradeNotice>
      )}

      {query.isLoading ? (
        <LoadingState label="Loading tables…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Could not load tables."}
          onRetry={() => query.refetch()}
        />
      ) : tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Add your first table to generate its customer ordering link and QR."
          action={
            <Button onClick={openCreate} disabled={atLimit}>
              <Plus />
              Add table
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {tables.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-[8rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-slate-900">{t.name}</span>
                  <span className="font-mono text-xs text-slate-400">{t.code}</span>
                  {!t.isActive && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.orderCount} order{t.orderCount === 1 ? "" : "s"}
                </p>
              </div>

              <Switch
                aria-label={`Toggle ${t.name}`}
                disabled={update.isPending}
                checked={t.isActive}
                onCheckedChange={() => update.mutate({ id: t.id, input: { isActive: !t.isActive } })}
                className="shrink-0"
              />

              <Button variant="secondary" size="sm" onClick={() => setQrTable(t)}>
                <QrCode />
                QR
              </Button>
              <Button variant="secondary" size="sm" onClick={() => copyLink(t)}>
                <Link2 />
                Copy link
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(t);
                  setFormOpen(true);
                }}
              >
                <Pencil />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${t.name}`}
                className="text-red-600 hover:bg-red-50"
                onClick={() => setDeleting(t)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
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
              update.mutate({ id: editing.id, input: values }, { onSuccess: closeForm });
            } else {
              create.mutate(values, { onSuccess: closeForm });
            }
          }}
        />
      </ModalDialog>

      <TableQrDialog table={qrTable} open={!!qrTable} onClose={() => setQrTable(null)} />

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
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}
