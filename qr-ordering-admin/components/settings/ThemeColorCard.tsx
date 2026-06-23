"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DEFAULT_HEX = "#059669";
const PRESETS = [
  "#059669",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#111827",
];
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

// Brand accent colour for the customer (mobile) ordering app. Saved through the
// shared settings mutation (themeColor); "Use default" clears it (null) so the
// app falls back to the default emerald theme. Editing is local until "Save"
// (the native colour input fires continuously while dragging).
export function ThemeColorCard({
  themeColor,
  saving,
  onSave,
}: {
  themeColor: string | null;
  saving: boolean;
  onSave: (themeColor: string | null) => void;
}) {
  const saved = themeColor ?? DEFAULT_HEX;
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(themeColor ?? DEFAULT_HEX), [themeColor]);

  const valid = isHex(draft);
  const dirty = valid && draft.toLowerCase() !== saved.toLowerCase();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <Palette className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-slate-900">Brand colour</p>
            <p className="text-sm text-slate-500">
              The accent colour customers see on the ordering app.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Brand colour picker"
            value={valid ? draft : DEFAULT_HEX}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          />
          <input
            type="text"
            aria-label="Brand colour hex"
            value={draft}
            onChange={(e) => setDraft(e.target.value.trim())}
            placeholder={DEFAULT_HEX}
            spellCheck={false}
            disabled={saving}
            className="h-10 w-32 rounded-lg border border-slate-200 px-3 font-mono text-sm uppercase tracking-wide focus:border-slate-400 focus:outline-none"
          />
          {!valid && draft.length > 0 && (
            <span className="text-xs text-red-500">Use a hex like #059669</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Use ${hex}`}
              onClick={() => setDraft(hex)}
              disabled={saving}
              style={{ backgroundColor: hex }}
              className={`h-7 w-7 rounded-full ring-offset-2 transition ${
                draft.toLowerCase() === hex.toLowerCase()
                  ? "ring-2 ring-slate-900"
                  : "ring-1 ring-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={() => onSave(draft)} disabled={!dirty || saving}>
            Save colour
          </Button>
          {themeColor && (
            <Button variant="ghost" size="sm" onClick={() => onSave(null)} disabled={saving}>
              Use default
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
