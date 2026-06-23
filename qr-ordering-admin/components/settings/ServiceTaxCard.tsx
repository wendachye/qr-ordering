"use client";

import { useEffect, useState } from "react";
import { Percent, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradeNotice } from "@/components/common/UpgradeNotice";

// Service charge + tax (SST). Menu prices are tax-inclusive: the report backs
// out these portions from the collected total. 0 hides them everywhere.
export function ServiceTaxCard({
  serviceChargeRate,
  taxes,
  locked,
  onSave,
  saving,
}: {
  serviceChargeRate: number;
  taxes: { name: string; rate: number }[];
  locked?: boolean;
  onSave: (v: { serviceChargeRate?: number; taxes: { name: string; rate: number }[] }) => void;
  saving: boolean;
}) {
  const [sc, setSc] = useState(String(serviceChargeRate));
  const [rows, setRows] = useState<{ name: string; rate: string }[]>(
    taxes.map((t) => ({ name: t.name, rate: String(t.rate) }))
  );
  useEffect(() => {
    setSc(String(serviceChargeRate));
    setRows(taxes.map((t) => ({ name: t.name, rate: String(t.rate) })));
  }, [serviceChargeRate, taxes]);

  const scNum = Number(sc);
  const cleaned = rows
    .map((r) => ({ name: r.name.trim(), rate: Number(r.rate) }))
    .filter((r) => r.name.length > 0);
  const valid =
    !Number.isNaN(scNum) &&
    scNum >= 0 &&
    scNum <= 100 &&
    rows.every(
      (r) =>
        r.name.trim().length > 0 && r.rate !== "" && Number(r.rate) >= 0 && Number(r.rate) <= 100
    );
  const taxesDirty =
    JSON.stringify(cleaned) !== JSON.stringify(taxes.map((t) => ({ name: t.name, rate: t.rate })));
  // When tax_multi is locked the service charge is read-only (Pro only), so it
  // never marks the card dirty and is omitted from the save payload below.
  const dirty = locked ? taxesDirty : scNum !== serviceChargeRate || taxesDirty;

  const addRow = () => setRows((r) => [...r, { name: "", rate: "" }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const setRow = (i: number, patch: Partial<{ name: string; rate: string }>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Percent className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">Service charge &amp; tax</p>
          <p className="text-sm text-slate-500">
            Menu prices are tax-inclusive — reports break out these portions from the collected
            total. Set 0% to hide them.
          </p>
        </div>
      </div>
      {locked && (
        <UpgradeNotice className="mt-4" title="Service charge & multiple taxes are a Pro feature">
          Basic includes a single tax. Upgrade to add a service charge and more than one tax.
        </UpgradeNotice>
      )}

      <div className="mt-4 max-w-[14rem]">
        <Label htmlFor="sc-rate">Service charge %</Label>
        <Input
          id="sc-rate"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={sc}
          disabled={locked}
          onChange={(e) => setSc(e.target.value)}
        />
        {locked && <p className="mt-1 text-xs text-slate-400">Service charge requires Pro.</p>}
      </div>

      <div className="mt-4">
        <Label>Taxes (e.g. SST, GST)</Label>
        <div className="mt-1 space-y-2">
          {rows.length === 0 && <p className="text-sm text-slate-400">No taxes configured.</p>}
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={row.name}
                maxLength={20}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="Tax name (e.g. SST)"
                className="flex-1"
              />
              <div className="flex w-28 items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={row.rate}
                  onChange={(e) => setRow(i, { rate: e.target.value })}
                  placeholder="6"
                />
                <span className="text-sm font-medium text-slate-500">%</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label="Remove tax"
                className="h-auto w-auto rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={addRow}
          disabled={rows.length >= (locked ? 1 : 8)}
        >
          <Plus />
          Add tax
        </Button>
        {locked && rows.length >= 1 && (
          <p className="mt-1 text-xs text-slate-400">Basic includes one tax — upgrade for more.</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {dirty && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>}
        <Button
          size="sm"
          disabled={!dirty || !valid || saving}
          onClick={() =>
            onSave(locked ? { taxes: cleaned } : { serviceChargeRate: scNum, taxes: cleaned })
          }
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
