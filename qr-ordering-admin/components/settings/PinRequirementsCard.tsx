"use client";

import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export type PinPatch = {
  voidPinRequired?: boolean;
  discountPinRequired?: boolean;
  overridePinRequired?: boolean;
};

// All "require the manager PIN for X" toggles in one place. A requirement can
// always be turned OFF, but can only be turned ON once an override PIN exists.
export function PinRequirementsCard({
  pinConfigured,
  overrides,
  discounts,
  voids,
  onToggle,
  saving,
}: {
  pinConfigured: boolean;
  overrides: boolean;
  discounts: boolean;
  voids: boolean;
  onToggle: (patch: PinPatch) => void;
  saving: boolean;
}) {
  const rows: { label: string; hint: string; enabled: boolean; patch: (v: boolean) => PinPatch }[] =
    [
      {
        label: "Price overrides",
        hint: "Changing an item's price",
        enabled: overrides,
        patch: (v) => ({ overridePinRequired: v }),
      },
      {
        label: "Discounts",
        hint: "Per-item or whole-bill discounts",
        enabled: discounts,
        patch: (v) => ({ discountPinRequired: v }),
      },
      {
        label: "Voids",
        hint: "Removing a sent item from a tab",
        enabled: voids,
        patch: (v) => ({ voidPinRequired: v }),
      },
    ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">Require PIN actions</p>
          <p className="text-sm text-slate-500">
            {pinConfigured
              ? "Staff enter the override PIN before these actions."
              : "Set an override PIN above to require it for these actions."}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100">
        {rows.map((r) => {
          // With no override PIN set, every requirement is OFF and locked — you
          // can't require a PIN that doesn't exist. Set one above to opt in.
          const disabled = saving || !pinConfigured;
          return (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                <p className="text-xs text-slate-400">{r.hint}</p>
              </div>
              <Switch
                checked={pinConfigured && r.enabled}
                disabled={disabled}
                onCheckedChange={() => onToggle(r.patch(!r.enabled))}
                aria-label={`Require PIN for ${r.label.toLowerCase()}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
