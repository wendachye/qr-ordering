"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/common/Toast";
import { platformClientsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Client, Outlet } from "@/lib/types";
import { OutletRow } from "@/components/platform/OutletRow";
import { OutletEditDialog } from "@/components/platform/OutletEditDialog";
import { AddOutletDialog } from "@/components/platform/AddOutletDialog";
import { ApplyPlan } from "@/components/platform/ApplyPlan";

export function ClientDetail({ client }: { client: Client }) {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
