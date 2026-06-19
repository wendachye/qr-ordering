"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Ticket } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PromotionsTabs } from "@/components/layout/PromotionsTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from "@/components/common/Toast";
import { vouchersApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { Voucher, VoucherInput, DiscountType } from "@/lib/types";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";

function valueLabel(v: Voucher): string {
  return v.discountType === "PERCENT" ? `${v.discountValue}% off` : `${formatPrice(v.discountValue)} off`;
}
function ymd(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { locked } = useEntitlements();
  const vouchersLocked = locked("vouchers");
  const query = useQuery({
    queryKey: ["vouchers"],
    queryFn: vouchersApi.list,
    enabled: !vouchersLocked,
  });

  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; voucher: Voucher } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vouchers"] });

  const save = useMutation({
    mutationFn: (input: VoucherInput & { id?: string }) =>
      input.id ? vouchersApi.update(input.id, input) : vouchersApi.create(input),
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast("Voucher saved.", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save the voucher.", "error"),
  });

  const toggleActive = useMutation({
    mutationFn: (v: Voucher) => vouchersApi.update(v.id, { isActive: !v.isActive }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not update.", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => vouchersApi.remove(id),
    onSuccess: (res) => {
      invalidate();
      setDeleteTarget(null);
      toast(res.deactivated ? "Voucher had redemptions — deactivated instead." : "Voucher deleted.", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not delete.", "error"),
  });

  const vouchers = query.data ?? [];

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Promotions</h1>
          <p className="mt-1 text-slate-500">Discount vouchers &amp; promo codes</p>
        </div>
        {!vouchersLocked && vouchers.length > 0 && (
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            New voucher
          </Button>
        )}
      </div>
      <PromotionsTabs />

      {vouchersLocked ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 font-semibold text-slate-700">Vouchers are a Pro feature</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Create discount codes that customers and staff can apply at checkout.
          </p>
          <div className="mx-auto mt-4 max-w-md text-left">
            <UpgradeNotice title="Upgrade to unlock vouchers &amp; promo codes" />
          </div>
        </div>
      ) : query.isLoading ? (
        <LoadingState label="Loading vouchers…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Could not load vouchers."}
          onRetry={() => query.refetch()}
        />
      ) : vouchers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 font-semibold text-slate-700">No vouchers yet</p>
          <p className="text-sm text-slate-500">
            Create a code customers or staff can apply for a discount at checkout.
          </p>
          <Button className="mt-4" onClick={() => setDialog({ mode: "create" })}>
            <Plus />
            New voucher
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {vouchers.map((v) => {
            const expired = v.expiresAt != null && new Date(v.expiresAt).getTime() < Date.now();
            const usedUp = v.maxRedemptions != null && v.redeemedCount >= v.maxRedemptions;
            return (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                  <Ticket className="h-5 w-5" />
                </span>
                <div className="min-w-[8rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold tracking-wide text-slate-900">
                      {v.code}
                    </span>
                    <Badge tone="green">{valueLabel(v)}</Badge>
                    {!v.isActive && <Badge tone="gray">Inactive</Badge>}
                    {v.isActive && expired && <Badge tone="amber">Expired</Badge>}
                    {v.isActive && !expired && usedUp && <Badge tone="amber">Used up</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {v.description ? `${v.description} · ` : ""}
                    {v.minSpend > 0 ? `Min ${formatPrice(v.minSpend)} · ` : ""}
                    {v.maxRedemptions != null
                      ? `${v.redeemedCount}/${v.maxRedemptions} used`
                      : `${v.redeemedCount} used`}
                    {v.expiresAt ? ` · expires ${ymd(v.expiresAt)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={v.isActive}
                  aria-label={`Toggle ${v.code}`}
                  disabled={toggleActive.isPending}
                  onClick={() => toggleActive.mutate(v)}
                  className={cn(
                    "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                    v.isActive ? "bg-accent-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                      v.isActive ? "left-6" : "left-1"
                    )}
                  />
                </button>
                <Button variant="secondary" size="sm" onClick={() => setDialog({ mode: "edit", voucher: v })}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteTarget(v)}
                >
                  Delete
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <ModalDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.mode === "edit" ? "Edit voucher" : "New voucher"}
      >
        {dialog && (
          <VoucherForm
            initial={dialog.mode === "edit" ? dialog.voucher : undefined}
            submitting={save.isPending}
            onCancel={() => setDialog(null)}
            onSubmit={(input) =>
              save.mutate(dialog.mode === "edit" ? { ...input, id: dialog.voucher.id } : input)
            }
          />
        )}
      </ModalDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete voucher?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.code}"? If it has been redeemed it will be deactivated instead (to keep the report history).`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </AdminShell>
  );
}

function VoucherForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Voucher;
  submitting: boolean;
  onSubmit: (input: VoucherInput) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(initial?.discountType ?? "PERCENT");
  const [discountValue, setDiscountValue] = useState(initial ? String(initial.discountValue) : "");
  const [minSpend, setMinSpend] = useState(initial?.minSpend ? String(initial.minSpend) : "");
  const [maxRedemptions, setMaxRedemptions] = useState(
    initial?.maxRedemptions != null ? String(initial.maxRedemptions) : ""
  );
  const [expiresAt, setExpiresAt] = useState(ymd(initial?.expiresAt ?? null));

  const dv = Number(discountValue);
  const codeOk = code.trim().length >= 2;
  const valueOk = dv > 0 && (discountType !== "PERCENT" || dv <= 100);
  const valid = codeOk && valueOk;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      code: code.trim(),
      description: description.trim() || null,
      discountType,
      discountValue: dv,
      minSpend: minSpend ? Number(minSpend) : 0,
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      // Expire at the end of the chosen day, or never.
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="v-code">Code</Label>
        <Input
          id="v-code"
          value={code}
          maxLength={40}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. WELCOME10"
          className="font-mono uppercase tracking-wide"
          autoFocus
        />
      </div>

      <div>
        <Label>Discount</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(
              [
                ["PERCENT", "% off"],
                ["FIXED", "$ off"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDiscountType(val)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  discountType === val ? "bg-accent-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {discountType === "FIXED" && <span className="text-sm font-medium text-slate-500">RM</span>}
            <Input
              type="number"
              min="0"
              step={discountType === "PERCENT" ? "1" : "0.10"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "PERCENT" ? "10" : "5.00"}
              className="w-24"
            />
            {discountType === "PERCENT" && <span className="text-sm font-medium text-slate-500">%</span>}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="v-desc">Description (optional)</Label>
        <Input
          id="v-desc"
          value={description}
          maxLength={120}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. New customer welcome offer"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="v-min">Min spend (RM)</Label>
          <Input
            id="v-min"
            type="number"
            min="0"
            step="0.10"
            value={minSpend}
            onChange={(e) => setMinSpend(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="v-max">Usage limit</Label>
          <Input
            id="v-max"
            type="number"
            min="1"
            step="1"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="∞"
          />
        </div>
        <div>
          <Label htmlFor="v-exp">Expires</Label>
          <Input
            id="v-exp"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid || submitting}>
          {submitting ? "Saving…" : initial ? "Save changes" : "Create voucher"}
        </Button>
      </div>
    </div>
  );
}
