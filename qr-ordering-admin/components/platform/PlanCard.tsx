"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/common/Toast";
import { platformPlansApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { PlanDef, PlanInput } from "@/lib/types";

const FEATURES = [
  { key: "loyalty", label: "Loyalty program", hint: "Members, points, stamps, reward catalog" },
  { key: "vouchers", label: "Vouchers / promo codes", hint: "Discount-code campaigns" },
  {
    key: "reports_advanced",
    label: "Advanced reports",
    hint: "Full analytics — Basic sees today's totals only",
  },
  {
    key: "tax_multi",
    label: "Multiple taxes + service charge",
    hint: "Basic gets a single tax, no service charge",
  },
];

export function PlanCard({ plan }: { plan: PlanDef }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PlanDef>(plan);

  const save = useMutation({
    mutationFn: (input: PlanInput) => platformPlansApi.update(plan.key, input),
    onSuccess: (plans) => {
      qc.setQueryData(["platform-plans"], plans);
      const fresh = plans.find((x) => x.key === plan.key);
      if (fresh) setDraft(fresh);
      toast(`${plan.name} saved.`, "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save.", "error"),
  });

  const patch = (p: Partial<PlanDef>) => setDraft((d) => ({ ...d, ...p }));
  const toggleFeature = (key: string) =>
    setDraft((d) => ({
      ...d,
      features: d.features.includes(key)
        ? d.features.filter((f) => f !== key)
        : [...d.features, key],
    }));
  const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0));

  const onSave = () =>
    save.mutate({
      name: draft.name.trim() || plan.key,
      description: draft.description?.trim() ? draft.description.trim() : null,
      monthlyPrice: Number(draft.monthlyPrice) || 0,
      currency: draft.currency.trim() || "MYR",
      stripePriceId: draft.stripePriceId?.trim() ? draft.stripePriceId.trim() : null,
      features: draft.features,
      maxTables: draft.maxTables,
      maxMenuItems: draft.maxMenuItems,
      isActive: draft.isActive,
    });

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">{draft.name || plan.key}</h2>
            <Badge tone="gray">{plan.key}</Badge>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
            <Checkbox
              checked={draft.isActive}
              onCheckedChange={(v) => patch({ isActive: v === true })}
              className="h-4 w-4"
            />
            Active
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Display name</Label>
            <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              className="min-h-[52px]"
            />
          </div>
          <div>
            <Label>Monthly price</Label>
            <div className="flex items-center gap-2">
              <Input
                value={draft.currency}
                onChange={(e) => patch({ currency: e.target.value.toUpperCase().slice(0, 4) })}
                aria-label="Currency"
                className="w-16"
              />
              <Input
                type="number"
                min="0"
                step="1"
                value={String(draft.monthlyPrice)}
                onChange={(e) => patch({ monthlyPrice: Number(e.target.value) || 0 })}
                aria-label="Monthly price"
              />
            </div>
          </div>
          <div>
            <Label>Stripe price ID</Label>
            <Input
              value={draft.stripePriceId ?? ""}
              onChange={(e) => patch({ stripePriceId: e.target.value })}
              placeholder="price_…"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div>
          <Label className="mb-2">Included features</Label>
          <div className="space-y-2">
            {FEATURES.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 transition-colors hover:bg-slate-50"
              >
                <Checkbox
                  checked={draft.features.includes(f.key)}
                  onCheckedChange={() => toggleFeature(f.key)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{f.label}</span>
                  <span className="block text-xs text-slate-400">{f.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          <div>
            <Label>Max tables</Label>
            <Input
              type="number"
              min="0"
              value={draft.maxTables == null ? "" : String(draft.maxTables)}
              onChange={(e) => patch({ maxTables: numOrNull(e.target.value) })}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label>Max menu items</Label>
            <Input
              type="number"
              min="0"
              value={draft.maxMenuItems == null ? "" : String(draft.maxMenuItems)}
              onChange={(e) => patch({ maxMenuItems: numOrNull(e.target.value) })}
              placeholder="Unlimited"
            />
          </div>
          <p className="col-span-2 text-xs text-slate-400">Leave a limit blank for unlimited.</p>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
