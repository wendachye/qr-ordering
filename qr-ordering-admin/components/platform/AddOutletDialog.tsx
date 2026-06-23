"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { useToast } from "@/components/common/Toast";
import { platformClientsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Client, PlanKey } from "@/lib/types";
import { PlanToggle } from "@/components/platform/PlanToggle";

export function AddOutletDialog({
  clientId,
  open,
  onClose,
  onAdded,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onAdded: (c: Client) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<PlanKey>("basic");
  const [trialDays, setTrialDays] = useState("14");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const add = useMutation({
    mutationFn: () =>
      platformClientsApi.addOutlet(clientId, {
        outletName: name.trim(),
        planKey: plan,
        trialDays: Number(trialDays) || 0,
        adminEmail: email.trim() || undefined,
        adminPassword: email.trim() ? pw : undefined,
      }),
    onSuccess: (c) => {
      onAdded(c);
      toast("Outlet added.", "success");
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not add the outlet.", "error"),
  });

  const valid = name.trim().length > 0 && (!email.trim() || pw.length >= 8);

  return (
    <ModalDialog open={open} onClose={onClose} title="Add outlet">
      <div className="space-y-4">
        <div>
          <Label>Outlet name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme — Penang" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Plan</Label>
            <PlanToggle value={plan} onChange={setPlan} />
          </div>
          <div>
            <Label>Trial days</Label>
            <Input type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          </div>
          <div>
            <Label>Owner email (optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Temp password</Label>
            <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="≥ 8 chars" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate()} disabled={!valid || add.isPending}>
            {add.isPending ? "Adding…" : "Add outlet"}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
