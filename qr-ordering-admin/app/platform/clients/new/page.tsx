"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/common/Toast";
import { cn } from "@/lib/cn";
import { platformClientsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { CreateClientInput, PlanKey } from "@/lib/types";

export default function NewClientPage() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({
    clientName: "",
    contactEmail: "",
    contactPhone: "",
    outletName: "",
    adminEmail: "",
    adminPassword: "",
    planKey: "basic" as PlanKey,
    trialDays: "14",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: (input: CreateClientInput) => platformClientsApi.create(input),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: ["platform-clients"] });
      toast("Client created.", "success");
      router.replace(`/platform/clients/${client.id}`);
    },
    onError: (e) =>
      toast(e instanceof ApiError ? e.message : "Could not create the client.", "error"),
  });

  const emailGiven = f.adminEmail.trim().length > 0;
  const valid =
    f.clientName.trim().length > 0 &&
    f.outletName.trim().length > 0 &&
    (!emailGiven || f.adminPassword.length >= 8);

  const submit = () => {
    if (!valid) return;
    create.mutate({
      clientName: f.clientName.trim(),
      contactEmail: f.contactEmail.trim() || null,
      contactPhone: f.contactPhone.trim() || null,
      outletName: f.outletName.trim(),
      adminEmail: emailGiven ? f.adminEmail.trim() : undefined,
      adminPassword: emailGiven ? f.adminPassword : undefined,
      planKey: f.planKey,
      trialDays: Number(f.trialDays) || 0,
    });
  };

  return (
    <AdminShell>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/platform/clients"
          className="mb-4 inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Clients
        </Link>
        <h1 className="mb-1 text-3xl font-black text-slate-900">New client</h1>
        <p className="mb-6 text-slate-500">
          Creates the account, its first outlet (with a starter menu + tables), and an optional
          owner login.
        </p>

        <Card>
          <CardContent className="space-y-5">
            <Field label="Client / brand name">
              <Input
                value={f.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="Acme F&B Group"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact email (optional)">
                <Input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
              </Field>
              <Field label="Contact phone (optional)">
                <Input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
              </Field>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
                First outlet
              </p>
              <Field label="Outlet name">
                <Input
                  value={f.outletName}
                  onChange={(e) => set("outletName", e.target.value)}
                  placeholder="Acme — KL"
                />
              </Field>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Plan">
                  <PlanToggle value={f.planKey} onChange={(v) => set("planKey", v)} />
                </Field>
                <Field label="Trial days (0 = active now)">
                  <Input
                    type="number"
                    min="0"
                    value={f.trialDays}
                    onChange={(e) => set("trialDays", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-400">
                Owner login (optional)
              </p>
              <p className="mb-3 text-sm text-slate-400">
                Leave blank to manage the outlet yourself via “View as”.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner email">
                  <Input value={f.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
                </Field>
                <Field label="Temp password (≥ 8 chars)">
                  <Input
                    type="text"
                    value={f.adminPassword}
                    onChange={(e) => set("adminPassword", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Link href="/platform/clients">
                <Button variant="secondary">Cancel</Button>
              </Link>
              <Button onClick={submit} disabled={!valid || create.isPending}>
                {create.isPending ? "Creating…" : "Create client"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function PlanToggle({ value, onChange }: { value: PlanKey; onChange: (v: PlanKey) => void }) {
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
