"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, KeyRound, Lock, Percent, Plus, ShoppingBag, Store, X } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { settingsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { MultiCombobox } from "@/components/ui/multi-combobox";

// Quick-pick suggestions for the payment-methods combobox (staff can add custom).
const PAYMENT_SUGGESTIONS = [
  "Cash",
  "Visa",
  "Mastercard",
  "American Express",
  "GrabPay",
  "Touch 'n Go",
  "Boost",
  "ShopeePay",
  "DuitNow QR",
  "Maybank QR",
  "Bank Transfer",
  "Alipay",
  "WeChat Pay",
  "Voucher",
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const update = useMutation({
    mutationFn: (input: {
      storeName?: string;
      takeawayCharge?: number;
      serviceChargeRate?: number;
      taxes?: { name: string; rate: number }[];
      voidPinRequired?: boolean;
      discountPinRequired?: boolean;
      overridePinRequired?: boolean;
      paymentMethods?: string[];
    }) => settingsApi.update(input),
    onSuccess: (s) => {
      queryClient.setQueryData(["settings"], s);
      // Keep the menu page's settings cache (takeaway charge / title) in sync.
      queryClient.invalidateQueries({ queryKey: ["menu-settings"] });
      toast("Settings saved.", "success");
    },
    onError: (e) =>
      toast(e instanceof ApiError ? e.message : "Could not save settings.", "error"),
  });

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">
          Restaurant details, charges, and the manager override PIN
        </p>
      </div>
      <SettingsTabs />

      {query.isLoading ? (
        <LoadingState label="Loading settings…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Could not load settings."
          }
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <div className="mx-auto max-w-2xl space-y-4">
          <InlineText
            icon={<Store className="h-5 w-5" />}
            title="Restaurant name"
            subtitle="Shown on receipts and the daily Z reading."
            value={query.data.storeName}
            saving={update.isPending}
            onSave={(v) => update.mutate({ storeName: v })}
          />
          <InlineNumber
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Takeaway charge"
            subtitle="Added per takeaway item — staff can waive it on each order."
            value={query.data.takeawayCharge}
            saving={update.isPending}
            onSave={(v) => update.mutate({ takeawayCharge: v })}
          />
          <ServiceTaxCard
            serviceChargeRate={query.data.serviceChargeRate}
            taxes={query.data.taxes}
            saving={update.isPending}
            onSave={(v) => update.mutate(v)}
          />
          <PaymentMethodsCard
            methods={query.data.paymentMethods}
            saving={update.isPending}
            onSave={(m) => update.mutate({ paymentMethods: m })}
          />
          <PinCard
            configured={query.data.pinConfigured}
            onSaved={() => query.refetch()}
          />
          <PinRequirementsCard
            pinConfigured={query.data.pinConfigured}
            overrides={query.data.overridePinRequired}
            discounts={query.data.discountPinRequired}
            voids={query.data.voidPinRequired}
            saving={update.isPending}
            onToggle={(patch) => update.mutate(patch)}
          />
        </div>
      ) : null}
    </AdminShell>
  );
}

function SettingShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            {icon}
          </span>
          <div>
            <p className="font-bold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function InlineText({
  icon,
  title,
  subtitle,
  value,
  onSave,
  saving,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: string;
  onSave: (v: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  return (
    <SettingShell icon={icon} title={title} subtitle={subtitle}>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-52"
            autoFocus
          />
          <Button
            size="sm"
            disabled={saving || !draft.trim()}
            onClick={() => {
              onSave(draft.trim());
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraft(value);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900">{value}</span>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}
    </SettingShell>
  );
}

function InlineNumber({
  icon,
  title,
  subtitle,
  value,
  onSave,
  saving,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: number;
  onSave: (v: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toFixed(2));
  useEffect(() => {
    if (!editing) setDraft(value.toFixed(2));
  }, [value, editing]);

  const save = () => {
    const n = Number(draft);
    if (!Number.isNaN(n) && n >= 0) {
      onSave(n);
      setEditing(false);
    }
  };

  return (
    <SettingShell icon={icon} title={title} subtitle={subtitle}>
      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">RM</span>
          <Input
            type="number"
            min="0"
            step="0.10"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-24"
            autoFocus
          />
          <Button size="sm" disabled={saving} onClick={save}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraft(value.toFixed(2));
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900">{formatPrice(value)}</span>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}
    </SettingShell>
  );
}

function PinCard({
  configured,
  onSaved,
}: {
  configured: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setPin("");
    setConfirm("");
    setPw("");
    setErr(null);
  };

  const save = useMutation({
    mutationFn: () => settingsApi.setPin(pw, pin),
    onSuccess: (res) => {
      if (res.ok) {
        toast("Override PIN saved.", "success");
        reset();
        onSaved();
      } else {
        setErr("Incorrect admin password.");
      }
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : "Could not save the PIN."),
  });

  const submit = () => {
    setErr(null);
    if (!/^\d{4,6}$/.test(pin)) return setErr("PIN must be 4–6 digits.");
    if (pin !== confirm) return setErr("PINs don't match.");
    if (!pw) return setErr("Enter your admin password to confirm.");
    save.mutate();
  };

  const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-slate-900">Override PIN</p>
            <p className="text-sm text-slate-500">
              Staff enter this 4–6 digit PIN to override an item&apos;s price.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              configured
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {configured ? "PIN set" : "Not set"}
          </span>
          {!open && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              {configured ? "Change" : "Set PIN"}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-pin">New PIN</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(onlyDigits(e.target.value))}
                placeholder="4–6 digits"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="confirm-pin">Confirm PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={confirm}
                onChange={(e) => setConfirm(onlyDigits(e.target.value))}
                placeholder="Re-enter"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="admin-pw">Admin password</Label>
            <Input
              id="admin-pw"
              type="password"
              autoComplete="off"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Confirm with your admin password"
            />
          </div>
          {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save PIN"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Service charge + tax (SST). Menu prices are tax-inclusive: the report backs
// out these portions from the collected total. 0 hides them everywhere.
function ServiceTaxCard({
  serviceChargeRate,
  taxes,
  onSave,
  saving,
}: {
  serviceChargeRate: number;
  taxes: { name: string; rate: number }[];
  onSave: (v: { serviceChargeRate: number; taxes: { name: string; rate: number }[] }) => void;
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
        r.name.trim().length > 0 &&
        r.rate !== "" &&
        Number(r.rate) >= 0 &&
        Number(r.rate) <= 100
    );
  const dirty =
    scNum !== serviceChargeRate ||
    JSON.stringify(cleaned) !== JSON.stringify(taxes.map((t) => ({ name: t.name, rate: t.rate })));

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
            Menu prices are tax-inclusive — reports break out these portions from the
            collected total. Set 0% to hide them.
          </p>
        </div>
      </div>
      <div className="mt-4 max-w-[14rem]">
        <Label htmlFor="sc-rate">Service charge %</Label>
        <Input
          id="sc-rate"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={sc}
          onChange={(e) => setSc(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <Label>Taxes (e.g. SST, GST)</Label>
        <div className="mt-1 space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-slate-400">No taxes configured.</p>
          )}
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
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove tax"
                className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={addRow}
          disabled={rows.length >= 8}
        >
          <Plus />
          Add tax
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {dirty && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>}
        <Button
          size="sm"
          disabled={!dirty || !valid || saving}
          onClick={() => onSave({ serviceChargeRate: scNum, taxes: cleaned })}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function PaymentMethodsCard({
  methods,
  onSave,
  saving,
}: {
  methods: string[];
  onSave: (m: string[]) => void;
  saving: boolean;
}) {
  const [list, setList] = useState<string[]>(methods);
  useEffect(() => {
    setList(methods);
  }, [methods]);

  const dirty = JSON.stringify(list) !== JSON.stringify(methods);
  const empty = list.length === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">Payment methods</p>
          <p className="text-sm text-slate-500">
            Shown in the Make-payment dialog when settling a tab.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <MultiCombobox
          value={list}
          onChange={setList}
          suggestions={PAYMENT_SUGGESTIONS}
          max={20}
          maxLen={40}
          placeholder="Select or add a payment method…"
          createLabel={(qq) => `Add “${qq}”`}
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {empty ? (
          <span className="text-sm font-medium text-red-600">Keep at least one method</span>
        ) : (
          dirty && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>
        )}
        <Button size="sm" disabled={!dirty || empty || saving} onClick={() => onSave(list)}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// A small on/off switch reused by the PIN-requirements rows.
function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent-600" : "bg-slate-300",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-6" : "left-1"
        )}
      />
    </button>
  );
}

type PinPatch = {
  voidPinRequired?: boolean;
  discountPinRequired?: boolean;
  overridePinRequired?: boolean;
};

// All "require the manager PIN for X" toggles in one place. A requirement can
// always be turned OFF, but can only be turned ON once an override PIN exists.
function PinRequirementsCard({
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
  const rows: { label: string; hint: string; enabled: boolean; patch: (v: boolean) => PinPatch }[] = [
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
                onChange={() => onToggle(r.patch(!r.enabled))}
                label={`Require PIN for ${r.label.toLowerCase()}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
