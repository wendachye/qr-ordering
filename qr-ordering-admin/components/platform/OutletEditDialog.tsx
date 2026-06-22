"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { useToast } from "@/components/common/Toast";
import { platformOutletsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Client, Outlet, PlanKey, SubStatus } from "@/lib/types";
import { PlanToggle } from "@/components/platform/PlanToggle";

const STATUSES: SubStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"];

export function OutletEditDialog({
  outlet,
  onClose,
  onSaved,
}: {
  outlet: Outlet | null;
  onClose: () => void;
  onSaved: (c: Client) => void;
}) {
  return (
    <ModalDialog open={!!outlet} onClose={onClose} title={outlet ? `Edit ${outlet.name}` : ""}>
      {outlet && <OutletEditBody key={outlet.id} outlet={outlet} onClose={onClose} onSaved={onSaved} />}
    </ModalDialog>
  );
}

function OutletEditBody({
  outlet,
  onClose,
  onSaved,
}: {
  outlet: Outlet;
  onClose: () => void;
  onSaved: (c: Client) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(outlet.name);
  const [plan, setPlan] = useState<PlanKey>(outlet.plan === "pro" ? "pro" : "basic");
  const [status, setStatus] = useState<SubStatus>(outlet.subscriptionStatus as SubStatus);
  const [trial, setTrial] = useState(outlet.trialEndsAt ? outlet.trialEndsAt.slice(0, 10) : "");
  const [isActive, setIsActive] = useState(outlet.isActive);

  const save = useMutation({
    mutationFn: () =>
      platformOutletsApi.update(outlet.id, {
        name: name.trim(),
        plan,
        subscriptionStatus: status,
        trialEndsAt: trial ? new Date(`${trial}T00:00:00.000Z`).toISOString() : null,
        isActive,
      }),
    onSuccess: (c) => {
      onSaved(c);
      toast("Outlet saved.", "success");
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save.", "error"),
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Plan</Label>
          <PlanToggle value={plan} onChange={setPlan} />
        </div>
        <div>
          <Label>Subscription</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubStatus)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Trial ends</Label>
          <Input type="date" value={trial} onChange={(e) => setTrial(e.target.value)} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
          />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save outlet"}
        </Button>
      </div>
    </div>
  );
}
