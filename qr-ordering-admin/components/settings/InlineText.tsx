"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingShell } from "./SettingShell";

// Inline-edit row for a single text setting (e.g. the store name).
export function InlineText({
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
