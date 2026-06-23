"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { SettingShell } from "./SettingShell";

// Inline-edit row for a single money setting (e.g. the takeaway charge).
export function InlineNumber({
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
