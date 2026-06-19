"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/common/Toast";
import { customerOrderLink } from "@/lib/customer";
import { copyToClipboard } from "@/lib/clipboard";
import type { Table } from "@/lib/types";

// Shows a printable QR + the customer link for a table, with a Copy-link button.
// Staff scan/print this for table-tent cards.
export function TableQrDialog({
  table,
  open,
  onClose,
}: {
  table: Pick<Table, "name" | "code"> | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const link = table ? customerOrderLink(table.code) : "";

  const copy = async () => {
    if (!link) return;
    if (await copyToClipboard(link)) {
      setCopied(true);
      toast("Link copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast("Could not copy. Copy it manually below.", "error");
    }
  };

  return (
    <ModalDialog
      open={open && !!table}
      onClose={onClose}
      title={table ? `${table.name} · ${table.code}` : "Table QR"}
    >
      {table && (
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <QRCodeSVG value={link} size={224} level="M" marginSize={2} />
          </div>

          <p className="break-all text-center text-sm text-slate-500">{link}</p>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={copy} className="w-full sm:w-auto">
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="secondary" className="w-full">
                Open link
              </Button>
            </a>
          </div>

          <p className="text-center text-xs text-slate-400">
            Print this QR on a table-tent card so customers can scan to order.
          </p>
        </div>
      )}
    </ModalDialog>
  );
}
