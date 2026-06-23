"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { useToast } from "@/components/common/Toast";
import { uploadImage, ApiError } from "@/lib/api";
import { assetUrl } from "@/lib/assets";
import type { Combo, ComboInput, MenuItem } from "@/lib/types";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

// Local editable shape (numbers as strings while typing).
type DraftOption = { menuItemId: string; priceDelta: string };
type DraftGroup = { name: string; options: DraftOption[] };

function initialGroups(combo?: Combo): DraftGroup[] {
  if (combo && combo.groups.length) {
    return combo.groups.map((g) => ({
      name: g.name,
      options: g.options.map((o) => ({
        menuItemId: o.menuItemId,
        priceDelta: o.priceDelta ? String(o.priceDelta) : "0",
      })),
    }));
  }
  return [{ name: "", options: [{ menuItemId: "", priceDelta: "0" }] }];
}

export function ComboForm({
  initial,
  items,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial?: Combo;
  items: MenuItem[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ComboInput) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [image, setImage] = useState<string | null>(initial?.imageUrls?.[0] ?? null);
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [posOnly, setPosOnly] = useState(initial?.posOnly ?? false);
  const [groups, setGroups] = useState<DraftGroup[]>(() => initialGroups(initial));
  const [submitted, setSubmitted] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Sorted item picker — only items that aren't sold out are useful, but we keep
  // all so an existing combo option still resolves; flag unavailable inline.
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const priceNum = Number(price);
  const nameError = !name.trim() ? "Name is required" : "";
  const priceError = price === "" || Number.isNaN(priceNum) || priceNum < 0 ? "Enter a base price" : "";
  const groupErrors = groups.map((g) => {
    if (!g.name.trim()) return "Group name is required";
    if (g.options.length === 0) return "Add at least one option";
    if (g.options.some((o) => !o.menuItemId)) return "Every option needs a menu item";
    return "";
  });
  const valid = !nameError && !priceError && groups.length > 0 && groupErrors.every((e) => !e);

  async function handleFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setImage(url);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const patchGroup = (gi: number, patch: Partial<DraftGroup>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const addGroup = () =>
    setGroups((gs) => [...gs, { name: "", options: [{ menuItemId: "", priceDelta: "0" }] }]);
  const removeGroup = (gi: number) => setGroups((gs) => gs.filter((_, i) => i !== gi));
  const addOption = (gi: number) =>
    patchGroup(gi, { options: [...groups[gi].options, { menuItemId: "", priceDelta: "0" }] });
  const removeOption = (gi: number, oi: number) =>
    patchGroup(gi, { options: groups[gi].options.filter((_, i) => i !== oi) });
  const patchOption = (gi: number, oi: number, patch: Partial<DraftOption>) =>
    patchGroup(gi, {
      options: groups[gi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
    });

  function submit() {
    setSubmitted(true);
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      imageUrls: image ? [image] : [],
      isAvailable,
      posOnly,
      groups: groups.map((g) => ({
        name: g.name.trim(),
        options: g.options.map((o) => ({
          menuItemId: o.menuItemId,
          priceDelta: Number(o.priceDelta) || 0,
        })),
      })),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="combo-name">Name</Label>
        <Input
          id="combo-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bento Set, Lunch Combo"
        />
        {submitted && <FieldError>{nameError}</FieldError>}
      </div>

      <div>
        <Label htmlFor="combo-desc">Description (optional)</Label>
        <Textarea
          id="combo-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's in the set?"
          rows={2}
        />
      </div>

      {/* Cover image */}
      <div>
        <Label>Cover image (optional)</Label>
        <div className="mt-1 flex items-center gap-3">
          {image && (
            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(image)} alt="" className="h-full w-full object-cover" />
              <Button
                variant="ghost"
                onClick={() => setImage(null)}
                aria-label="Remove image"
                className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 p-0 text-white hover:bg-red-600 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
          {!image && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {uploading ? "Uploading…" : "Add image"}
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="combo-price">Base price (RM)</Label>
        <Input
          id="combo-price"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          className="w-40"
        />
        <p className="mt-1 text-sm text-slate-400">
          A premium pick can add an upcharge on top of this.
        </p>
        {submitted && <FieldError>{priceError}</FieldError>}
      </div>

      {/* Groups — the diner picks exactly one option from each */}
      <div>
        <Label>Choices</Label>
        <p className="mb-2 text-sm text-slate-400">
          Each group is one pick (e.g. Main, Side, Drink). Add the menu items a diner can
          choose from.
        </p>
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={g.name}
                  onChange={(e) => patchGroup(gi, { name: e.target.value })}
                  placeholder="Group name (e.g. Main, Side, Drink)"
                  className="h-10 flex-1 bg-white"
                />
                <Button
                  variant="ghost"
                  onClick={() => removeGroup(gi)}
                  aria-label={`Remove group ${gi + 1}`}
                  disabled={groups.length === 1}
                  className="h-auto shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {g.options.map((o, oi) => {
                  const it = itemById.get(o.menuItemId);
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <Select
                        value={o.menuItemId || undefined}
                        onValueChange={(v) => patchOption(gi, oi, { menuItemId: v })}
                      >
                        <SelectTrigger className="h-10 min-w-0 flex-1 bg-white">
                          <SelectValue placeholder="Pick a menu item" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedItems.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name}
                              {!i.isAvailable ? " (sold out)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm font-medium text-slate-500">+RM</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.10"
                        value={o.priceDelta}
                        onChange={(e) => patchOption(gi, oi, { priceDelta: e.target.value })}
                        aria-label="Upcharge"
                        className="h-10 w-20 bg-white"
                      />
                      <Button
                        variant="ghost"
                        onClick={() => removeOption(gi, oi)}
                        aria-label={`Remove option ${oi + 1}`}
                        disabled={g.options.length === 1}
                        className="h-auto shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {it && !it.isAvailable && (
                        <span className="sr-only">sold out</span>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addOption(gi)}
                  className="h-auto px-2 py-1 text-accent-700 hover:bg-accent-50"
                >
                  <Plus className="h-4 w-4" />
                  Add option
                </Button>
              </div>
              {submitted && groupErrors[gi] && <FieldError>{groupErrors[gi]}</FieldError>}
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={addGroup}
          className="mt-3"
        >
          <Plus />
          Add group
        </Button>
      </div>

      {/* Availability + visibility */}
      <div className="space-y-2 border-t border-slate-100 pt-4">
        <Label className="flex cursor-pointer items-center gap-3">
          <Checkbox
            checked={isAvailable}
            onCheckedChange={(v) => setIsAvailable(v === true)}
            className="h-5 w-5"
          />
          <span className="text-base font-medium text-slate-700">
            Available (uncheck to hide / mark sold out)
          </span>
        </Label>
        <Label className="flex cursor-pointer items-center gap-3">
          <Checkbox
            checked={posOnly}
            onCheckedChange={(v) => setPosOnly(v === true)}
            className="h-5 w-5"
          />
          <span className="text-base font-medium text-slate-700">
            POS only (staff can order it; hidden from the customer menu)
          </span>
        </Label>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting || (submitted && !valid)}>
          {submitting ? "Saving…" : initial ? "Save changes" : "Create combo"}
        </Button>
      </div>
    </div>
  );
}
