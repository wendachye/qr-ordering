"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/common/Toast";
import { settingsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// Set / change the manager override PIN. Saving requires the admin password.
export function PinCard({ configured, onSaved }: { configured: boolean; onSaved: () => void }) {
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
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save the PIN."),
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
              configured ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
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
