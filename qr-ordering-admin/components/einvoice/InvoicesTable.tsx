"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { einvoiceApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

// The latest issued e-Invoices. Draft / invalid rows can be (re)submitted to the
// MyInvois sandbox; valid rows link out to the LHDN validation page.
export function InvoicesTable() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["einvoice-invoices"],
    queryFn: () => einvoiceApi.listInvoices({ limit: 50, offset: 0 }),
  });

  const submit = useMutation({
    mutationFn: (id: string) => einvoiceApi.submitInvoice(id),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["einvoice-invoices"] });
      if (inv.status === "valid") toast(`Invoice ${inv.number} validated.`, "success");
      else if (inv.status === "invalid")
        toast(inv.rejectionReason ?? `Invoice ${inv.number} was rejected.`, "error");
      else toast(`Invoice ${inv.number} submitted.`, "info");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not submit invoice.", "error"),
  });

  if (query.isLoading) return <LoadingState label="Loading invoices…" />;
  if (query.isError)
    return (
      <ErrorState
        message={query.error instanceof ApiError ? query.error.message : "Could not load invoices."}
        onRetry={() => query.refetch()}
      />
    );

  const invoices = query.data?.invoices ?? [];

  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-slate-700">No e-Invoices yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Issue one from a settled tab to see it here.
        </p>
      </div>
    );
  }

  const canSubmit = (inv: Invoice) => inv.status === "draft" || inv.status === "invalid";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-mono font-semibold text-slate-800">
                {inv.number}
              </TableCell>
              <TableCell className="text-slate-500">
                {inv.createdAt ? formatDateTime(inv.createdAt) : "—"}
              </TableCell>
              <TableCell className="text-slate-700">{inv.buyerName || "—"}</TableCell>
              <TableCell className="text-right font-semibold text-slate-800">
                RM{inv.total.toFixed(2)}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={inv.status} />
              </TableCell>
              <TableCell className="text-right">
                {canSubmit(inv) ? (
                  <Button
                    size="xs"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate(inv.id)}
                  >
                    <Send />
                    Submit
                  </Button>
                ) : inv.status === "valid" && inv.validationUrl ? (
                  <Button asChild variant="secondary" size="xs">
                    <a href={inv.validationUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      Validate
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-slate-300">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
