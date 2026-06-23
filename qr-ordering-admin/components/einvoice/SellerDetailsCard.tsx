"use client";

import { useEffect, useState } from "react";
import { FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EinvoiceSettings, EinvoiceSettingsInput } from "@/lib/types";

// Trim then collapse empty strings to null so cleared fields are stored as null
// (matching the backend's string|null seller fields).
function clean(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Seller details + MyInvois mode. Menu prices are tax-inclusive; the invoice
// breaks out service charge + tax. Saved through PATCH /admin/einvoice/settings.
export function SellerDetailsCard({
  settings,
  onSave,
  saving,
}: {
  settings: EinvoiceSettings;
  onSave: (input: EinvoiceSettingsInput) => void;
  saving: boolean;
}) {
  const [enabled, setEnabled] = useState(settings.einvoiceEnabled);
  const [mode, setMode] = useState<"sandbox" | "production">(settings.einvoiceMode);
  const [tin, setTin] = useState(settings.sellerTin ?? "");
  const [reg, setReg] = useState(settings.sellerRegistrationNo ?? "");
  const [sst, setSst] = useState(settings.sellerSstNo ?? "");
  const [msic, setMsic] = useState(settings.sellerMsic ?? "");
  const [email, setEmail] = useState(settings.sellerEmail ?? "");
  const [phone, setPhone] = useState(settings.sellerPhone ?? "");
  const [address, setAddress] = useState(settings.sellerAddress ?? "");

  useEffect(() => {
    setEnabled(settings.einvoiceEnabled);
    setMode(settings.einvoiceMode);
    setTin(settings.sellerTin ?? "");
    setReg(settings.sellerRegistrationNo ?? "");
    setSst(settings.sellerSstNo ?? "");
    setMsic(settings.sellerMsic ?? "");
    setEmail(settings.sellerEmail ?? "");
    setPhone(settings.sellerPhone ?? "");
    setAddress(settings.sellerAddress ?? "");
  }, [settings]);

  const next: EinvoiceSettingsInput = {
    einvoiceEnabled: enabled,
    einvoiceMode: mode,
    sellerTin: clean(tin),
    sellerRegistrationNo: clean(reg),
    sellerSstNo: clean(sst),
    sellerMsic: clean(msic),
    sellerEmail: clean(email),
    sellerPhone: clean(phone),
    sellerAddress: clean(address),
  };

  const current: EinvoiceSettingsInput = {
    einvoiceEnabled: settings.einvoiceEnabled,
    einvoiceMode: settings.einvoiceMode,
    sellerTin: settings.sellerTin,
    sellerRegistrationNo: settings.sellerRegistrationNo,
    sellerSstNo: settings.sellerSstNo,
    sellerMsic: settings.sellerMsic,
    sellerEmail: settings.sellerEmail,
    sellerPhone: settings.sellerPhone,
    sellerAddress: settings.sellerAddress,
  };
  const dirty = JSON.stringify(next) !== JSON.stringify(current);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">e-Invoice (MyInvois)</p>
          <p className="text-sm text-slate-500">
            Issue LHDN-compliant e-Invoices for settled tabs. These seller details appear on
            every submitted invoice.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-800">Enable e-Invoicing</p>
          <p className="text-xs text-slate-400">Turn on to issue + submit invoices.</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Enable e-Invoicing"
        />
      </div>

      <div className="mt-4 max-w-[16rem]">
        <Label htmlFor="ei-mode">Submission mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as "sandbox" | "production")}>
          <SelectTrigger id="ei-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
            <SelectItem value="production">Production (live)</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Production submission needs your LHDN MyInvois credentials + certificate.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ei-tin">TIN</Label>
          <Input
            id="ei-tin"
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            placeholder="C1234567890"
          />
        </div>
        <div>
          <Label htmlFor="ei-reg">Business registration no.</Label>
          <Input
            id="ei-reg"
            value={reg}
            onChange={(e) => setReg(e.target.value)}
            placeholder="202301234567"
          />
        </div>
        <div>
          <Label htmlFor="ei-sst">SST no.</Label>
          <Input
            id="ei-sst"
            value={sst}
            onChange={(e) => setSst(e.target.value)}
            placeholder="W10-1234-56789012"
          />
        </div>
        <div>
          <Label htmlFor="ei-msic">MSIC code</Label>
          <Input
            id="ei-msic"
            value={msic}
            onChange={(e) => setMsic(e.target.value)}
            placeholder="56101"
          />
        </div>
        <div>
          <Label htmlFor="ei-email">Email</Label>
          <Input
            id="ei-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="billing@restaurant.com"
          />
        </div>
        <div>
          <Label htmlFor="ei-phone">Phone</Label>
          <Input
            id="ei-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+60123456789"
          />
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="ei-address">Address</Label>
        <Textarea
          id="ei-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, city, postcode, state"
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {dirty && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>}
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(next)}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
