"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { useToast } from "@/components/common/Toast";
import { einvoiceApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Invoice, InvoiceBuyerInput } from "@/lib/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

// Compact e-Invoice block for a settled tab: shows the issued invoice (number +
// status + submit / validation link) or a "Generate" action that opens a dialog
// to optionally capture buyer details before issuing.
export function SessionInvoiceCard({ sessionId }: { sessionId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const key = ["einvoice-session", sessionId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => einvoiceApi.sessionInvoice(sessionId),
  });

  const submit = useMutation({
    mutationFn: (id: string) => einvoiceApi.submitInvoice(id),
    onSuccess: (inv) => {
      qc.setQueryData(key, inv);
      qc.invalidateQueries({ queryKey: ["einvoice-invoices"] });
      if (inv.status === "valid") toast(`Invoice ${inv.number} validated.`, "success");
      else if (inv.status === "invalid")
        toast(inv.rejectionReason ?? `Invoice ${inv.number} was rejected.`, "error");
      else toast(`Invoice ${inv.number} submitted.`, "info");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not submit invoice.", "error"),
  });

  const invoice = query.data ?? null;

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-slate-900">e-Invoice</p>
              <p className="text-sm text-slate-500">
                {query.isLoading
                  ? "Checking…"
                  : invoice
                    ? `Invoice ${invoice.number}`
                    : "Issue a MyInvois e-Invoice for this tab."}
              </p>
            </div>
          </div>

          {!query.isLoading && (
            <div className="flex items-center gap-2">
              {invoice ? (
                <>
                  <InvoiceStatusBadge status={invoice.status} />
                  {(invoice.status === "draft" || invoice.status === "invalid") && (
                    <Button
                      size="sm"
                      disabled={submit.isPending}
                      onClick={() => submit.mutate(invoice.id)}
                    >
                      <Send />
                      Submit
                    </Button>
                  )}
                  {invoice.status === "valid" && invoice.validationUrl && (
                    <Button asChild variant="secondary" size="sm">
                      <a href={invoice.validationUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        Validate
                      </a>
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <FileText />
                  Generate e-Invoice
                </Button>
              )}
            </div>
          )}
        </div>

        {invoice?.status === "invalid" && invoice.rejectionReason && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {invoice.rejectionReason}
          </p>
        )}
      </CardContent>

      <GenerateInvoiceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sessionId={sessionId}
        onIssued={(inv) => {
          qc.setQueryData(key, inv);
          qc.invalidateQueries({ queryKey: ["einvoice-invoices"] });
          setDialogOpen(false);
        }}
      />
    </Card>
  );
}

// Optional buyer capture before issuing. All fields are optional — a blank form
// issues a consolidated / "general public" invoice.
function GenerateInvoiceDialog({
  open,
  onClose,
  sessionId,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onIssued: (invoice: Invoice) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [tin, setTin] = useState("");
  const [reg, setReg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const reset = () => {
    setName("");
    setTin("");
    setReg("");
    setEmail("");
    setPhone("");
    setAddress("");
  };

  const issue = useMutation({
    mutationFn: () => {
      const buyer: InvoiceBuyerInput = {};
      if (name.trim()) buyer.buyerName = name.trim();
      if (tin.trim()) buyer.buyerTin = tin.trim();
      if (reg.trim()) buyer.buyerRegistrationNo = reg.trim();
      if (email.trim()) buyer.buyerEmail = email.trim();
      if (phone.trim()) buyer.buyerPhone = phone.trim();
      if (address.trim()) buyer.buyerAddress = address.trim();
      return einvoiceApi.issueForSession(sessionId, buyer);
    },
    onSuccess: (inv) => {
      toast(`e-Invoice ${inv.number} issued.`, "success");
      reset();
      onIssued(inv);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not issue invoice.", "error"),
  });

  return (
    <ModalDialog open={open} onClose={onClose} title="Generate e-Invoice">
      <p className="text-sm text-slate-500">
        Buyer details are optional — leave blank to issue to the general public.
      </p>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="buyer-name">Buyer name</Label>
            <Input
              id="buyer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="buyer-tin">TIN</Label>
            <Input
              id="buyer-tin"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="buyer-reg">Registration no.</Label>
            <Input
              id="buyer-reg"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="buyer-email">Email</Label>
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="buyer-phone">Phone</Label>
            <Input
              id="buyer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="buyer-address">Address</Label>
          <Textarea
            id="buyer-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={issue.isPending}>
            Cancel
          </Button>
          <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
            <FileText />
            {issue.isPending ? "Issuing…" : "Issue e-Invoice"}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
