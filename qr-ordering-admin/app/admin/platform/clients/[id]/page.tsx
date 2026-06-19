"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Plus, Settings2 } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";
import { platformClientsApi, platformOutletsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Client, Outlet, PlanKey, SubStatus } from "@/lib/types";

const STATUSES: SubStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"];
const STATUS_TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  ACTIVE: "green",
  TRIALING: "amber",
  PAST_DUE: "amber",
  CANCELED: "red",
};

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({
    queryKey: ["platform-client", id],
    queryFn: () => platformClientsApi.get(id),
  });
  return (
    <AdminShell>
      <Link
        href="/admin/platform/clients"
        className="mb-4 inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </Link>
      {q.isLoading ? (
        <LoadingState label="Loading client…" />
      ) : q.isError ? (
        <ErrorState message="Could not load this client." onRetry={() => q.refetch()} />
      ) : q.data ? (
        <ClientDetail client={q.data} />
      ) : null}
    </AdminShell>
  );
}

function PlanToggle({ value, onChange }: { value: PlanKey; onChange: (v: PlanKey) => void }) {
  return (
    <div className="inline-flex h-10 rounded-lg border border-slate-200 p-0.5">
      {(["basic", "pro"] as PlanKey[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "rounded-md px-4 text-sm font-semibold capitalize transition-colors",
            value === p ? "bg-accent-600 text-white" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function ClientDetail({ client }: { client: Client }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const setData = (c: Client) => qc.setQueryData(["platform-client", client.id], c);

  const [draft, setDraft] = useState({
    name: client.name,
    contactEmail: client.contactEmail ?? "",
    contactPhone: client.contactPhone ?? "",
    notes: client.notes ?? "",
    isActive: client.isActive,
  });
  const saveClient = useMutation({
    mutationFn: () =>
      platformClientsApi.update(client.id, {
        name: draft.name.trim(),
        contactEmail: draft.contactEmail.trim() || null,
        contactPhone: draft.contactPhone.trim() || null,
        notes: draft.notes.trim() || null,
        isActive: draft.isActive,
      }),
    onSuccess: (c) => {
      setData(c);
      qc.invalidateQueries({ queryKey: ["platform-clients"] });
      toast("Client saved.", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save.", "error"),
  });

  const [editing, setEditing] = useState<Outlet | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-black text-slate-900">{client.name}</h1>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
              />
              Active
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input
                value={draft.contactEmail}
                onChange={(e) => setDraft((d) => ({ ...d, contactEmail: e.target.value }))}
              />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input
                value={draft.contactPhone}
                onChange={(e) => setDraft((d) => ({ ...d, contactPhone: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                className="min-h-[52px]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveClient.mutate()} disabled={saveClient.isPending}>
              {saveClient.isPending ? "Saving…" : "Save client"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Outlets ({client.outletCount})</h2>
        <div className="flex items-center gap-2">
          <ApplyPlan clientId={client.id} onApplied={setData} />
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus />
            Add outlet
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {client.outlets.map((o) => (
          <OutletRow key={o.id} outlet={o} onEdit={() => setEditing(o)} />
        ))}
      </div>

      <OutletEditDialog outlet={editing} onClose={() => setEditing(null)} onSaved={setData} />
      <AddOutletDialog
        clientId={client.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={setData}
      />
    </div>
  );
}

function OutletRow({ outlet, onEdit }: { outlet: Outlet; onEdit: () => void }) {
  const { impersonate } = useAuth();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-slate-900">{outlet.name}</h3>
            <Badge tone="gray">{outlet.plan ?? "—"}</Badge>
            <Badge tone={STATUS_TONE[outlet.subscriptionStatus] ?? "gray"}>
              {outlet.subscriptionStatus}
            </Badge>
            {!outlet.isActive && <Badge tone="red">Suspended</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {outlet.tableCount} tables · {outlet.menuItemCount} items · {outlet.slug}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void impersonate(outlet.id, outlet.name)}>
            <Eye className="h-4 w-4" />
            View as
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Settings2 className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OutletEditDialog({
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
      <div className="grid grid-cols-2 gap-3">
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

function AddOutletDialog({
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
        <div className="grid grid-cols-2 gap-3">
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

function ApplyPlan({ clientId, onApplied }: { clientId: string; onApplied: (c: Client) => void }) {
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
