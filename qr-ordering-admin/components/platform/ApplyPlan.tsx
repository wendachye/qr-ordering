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

export function ApplyPlan({ clientId, onApplied }: { clientId: string; onApplied: (c: Client) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanKey>("pro");
  const [trialDays, setTrialDays] = useState("0");

  const apply = useMutation({
    mutationFn: () =>
      platformClientsApi.applyPlan(clientId, { planKey: plan, trialDays: Number(trialDays) || 0 }),
    onSuccess: (c) => {
      onApplied(c);
      toast("Applied to all outlets.", "success");
      setOpen(false);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not apply.", "error"),
  });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Apply plan to all
      </Button>
      <ModalDialog open={open} onClose={() => setOpen(false)} title="Apply plan to all outlets">
        <div className="space-y-4">
          <div>
            <Label>Plan</Label>
            <PlanToggle value={plan} onChange={setPlan} />
          </div>
          <div>
            <Label>Trial days (0 = active now)</Label>
            <Input type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
