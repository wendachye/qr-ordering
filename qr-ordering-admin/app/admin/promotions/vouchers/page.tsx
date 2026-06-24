"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Ticket } from "lucide-react";
import { PromotionsTabs } from "@/components/promotions/PromotionsTabs";
import { VoucherForm } from "@/components/promotions/VoucherForm";
import { VoucherRow } from "@/components/promotions/VoucherRow";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { vouchersApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Voucher, VoucherInput } from "@/lib/types";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";

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

  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; voucher: Voucher } | null
  >(null);

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

  const vouchers = query.data ?? [];

  return (
    <>
      <PromotionsTabs
        action={
          !vouchersLocked && vouchers.length > 0 ? (
            <Button size="xs" onClick={() => setDialog({ mode: "create" })}>
              <Plus />
              New voucher
            </Button>
          ) : undefined
        }
      />

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
          message={
            query.error instanceof ApiError ? query.error.message : "Could not load vouchers."
          }
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
          {vouchers.map((v) => (
            <VoucherRow
              key={v.id}
              voucher={v}
              toggling={toggleActive.isPending}
              onToggle={() => toggleActive.mutate(v)}
              onEdit={() => setDialog({ mode: "edit", voucher: v })}
            />
          ))}
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
    </>
  );
}
