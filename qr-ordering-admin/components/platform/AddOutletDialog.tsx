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
import type { Client, ClientCatalogue, PlanKey } from "@/lib/types";
import { PlanToggle } from "@/components/platform/PlanToggle";
import { cn } from "@/lib/utils";

export function AddOutletDialog({
  clientId,
  catalogues,
  open,
  onClose,
  onAdded,
}: {
  clientId: string;
  // The client's existing brand menus — pick one to share, or create a new menu.
  catalogues: ClientCatalogue[];
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
  // Menu: a fresh catalogue, or share one of the client's existing brand menus.
  const canShare = catalogues.length > 0;
  const [menuMode, setMenuMode] = useState<"new" | "share">("new");
  const [catalogueId, setCatalogueId] = useState(catalogues[0]?.id ?? "");

  const add = useMutation({
    mutationFn: () =>
      platformClientsApi.addOutlet(clientId, {
        outletName: name.trim(),
        planKey: plan,
        trialDays: Number(trialDays) || 0,
        adminEmail: email.trim() || undefined,
        adminPassword: email.trim() ? pw : undefined,
        catalogueId: menuMode === "share" ? catalogueId : undefined,
      }),
    onSuccess: (c) => {
      onAdded(c);
      toast("Outlet added.", "success");
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not add the outlet.", "error"),
  });

  const valid =
    name.trim().length > 0 &&
    (!email.trim() || pw.length >= 8) &&
    (menuMode === "new" || !!catalogueId);

  return (
    <ModalDialog open={open} onClose={onClose} title="Add outlet">
      <div className="space-y-4">
        <div>
          <Label>Outlet name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme — Penang" />
        </div>

        {/* Menu: new catalogue vs share an existing brand menu. */}
        {canShare && (
          <div className="space-y-2">
            <Label className="mb-0">Menu</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["new", "New menu"],
                  ["share", "Share existing"],
                ] as [typeof menuMode, string][]
              ).map(([val, label]) => (
                <Button
                  key={val}
                  type="button"
                  variant={menuMode === val ? "default" : "secondary"}
                  size="sm"
                  aria-pressed={menuMode === val}
                  onClick={() => setMenuMode(val)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {menuMode === "share" ? (
              <div className="space-y-1.5">
                {catalogues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatalogueId(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      catalogueId === c.id
                        ? "border-accent-400 bg-accent-50 text-accent-900"
                        : "border-slate-200 hover:border-accent-300 hover:bg-accent-50/50",
                    )}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-slate-500">
                      shared by {c.outletCount} {c.outletCount === 1 ? "outlet" : "outlets"}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-slate-500">
                  This outlet serves the chosen brand menu. Edits there apply to every
                  outlet on it; set per-outlet price / availability from the menu page.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Starts a fresh menu for this outlet (a sample dish to edit).
              </p>
            )}
          </div>
        )}

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
