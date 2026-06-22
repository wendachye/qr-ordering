"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/common/Toast";
import { uploadImage, ApiError } from "@/lib/api";
import { assetUrl } from "@/lib/assets";
import type { Category, MenuItem, MenuItemInput } from "@/lib/types";

const MAX_IMAGES = 8;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const MAX_TAGS = 8;
const MAX_TAG_LEN = 24;
// Quick-pick suggestions; staff can also type free-text tags.
const SUGGESTED_TAGS = [
  "Spicy",
  "Hot",
  "Vegetarian",
  "Vegan",
  "Halal",
  "Gluten-free",
  "Contains nuts",
  "Chef's",
  "New",
  "Signature",
];

const schema = z.object({
  categoryId: z.string().min(1, "Please choose a category"),
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  description: z.string().trim().max(500, "Description is too long").optional(),
  price: z.coerce
    .number({ invalid_type_error: "Price must be a number" })
    .min(0, "Price must be 0 or more")
    .max(100000, "Price is too large"),
  isAvailable: z.boolean(),
  posOnly: z.boolean(),
});

export type MenuItemFormValues = z.infer<typeof schema>;

// Local draft shapes for the option-group editor (strings while typing).
type ChoiceDraft = { name: string; price: string };
type GroupDraft = {
  name: string;
  required: boolean;
  multiple: boolean;
  min: string;
  max: string;
  choices: ChoiceDraft[];
};

export function MenuItemForm({
  initial,
  categories,
  defaultCategoryId,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: MenuItem;
  categories: Category[];
  // Pre-selected category when adding from a specific section. Ignored on edit.
  defaultCategoryId?: string;
  submitting: boolean;
  onSubmit: (values: MenuItemInput) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  // Availability window: days (0=Sun..6=Sat; empty = every day) + venue-local
  // from/to (blank = all day; may wrap past midnight).
  const [availDays, setAvailDays] = useState<number[]>(initial?.availableDays ?? []);
  const [availFrom, setAvailFrom] = useState<string>(initial?.availableFrom ?? "");
  const [availTo, setAvailTo] = useState<string>(initial?.availableTo ?? "");
  const toggleDay = (d: number) =>
    setAvailDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED" | null>(
    initial?.discountType ?? null
  );
  const [discountValue, setDiscountValue] = useState<string>(
    initial?.discountValue ? String(initial.discountValue) : ""
  );

  // Configurable option groups (size, spice level, add-ons …). Edited as drafts;
  // prices/max are kept as strings while typing. `multiple` => maxSelect > 1.
  const [groups, setGroups] = useState<GroupDraft[]>(() =>
    (initial?.optionGroups ?? []).map((g) => ({
      name: g.name,
      required: g.required,
      multiple: g.maxSelect > 1,
      min: String(g.minSelect),
      max: String(g.maxSelect),
      choices: g.choices.map((c) => ({
        name: c.name,
        price: c.priceDelta ? String(c.priceDelta) : "",
      })),
    }))
  );
  const addGroup = () =>
    setGroups((p) => [
      ...p,
      {
        name: "",
        required: true,
        multiple: false,
        min: "1",
        max: "2",
        choices: [{ name: "", price: "" }],
      },
    ]);
  const removeGroup = (gi: number) => setGroups((p) => p.filter((_, i) => i !== gi));
  const patchGroup = (gi: number, patch: Partial<GroupDraft>) =>
    setGroups((p) => p.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const addChoice = (gi: number) =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi ? { ...g, choices: [...g.choices, { name: "", price: "" }] } : g
      )
    );
  const removeChoice = (gi: number, ci: number) =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi ? { ...g, choices: g.choices.filter((_, j) => j !== ci) } : g
      )
    );
  const patchChoice = (gi: number, ci: number, patch: Partial<ChoiceDraft>) =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi
          ? { ...g, choices: g.choices.map((c, j) => (j === ci ? { ...c, ...patch } : c)) }
          : g
      )
    );
  // A group with a name but no named choices is a mistake — block save.
  const optionsError = groups.some(
    (g) => g.name.trim() && g.choices.filter((c) => c.name.trim()).length === 0
  )
    ? "Each option group needs at least one choice."
    : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      price: initial?.price ?? 0,
      isAvailable: initial?.isAvailable ?? true,
      posOnly: initial?.posOnly ?? false,
    },
  });

  const isAvailable = watch("isAvailable");
  const posOnly = watch("posOnly");
  const atLimit = imageUrls.length >= MAX_IMAGES;

  // Standing menu discount preview (customer sale price).
  const priceNum = Number(watch("price")) || 0;
  const dvNum = Number(discountValue);
  const discountInvalid =
    !!discountType && (!(dvNum > 0) || (discountType === "PERCENT" && dvNum > 100));
  const salePreview =
    discountType && dvNum > 0
      ? Math.max(
          0,
          discountType === "PERCENT" ? priceNum * (1 - Math.min(100, dvNum) / 100) : priceNum - dvNum
        )
      : null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Respect the cap across this batch.
    const remaining = MAX_IMAGES - imageUrls.length;
    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    if (chosen.length === 0) return;

    setUploading(true);
    try {
      for (const file of chosen) {
        const url = await uploadImage(file);
        setImageUrls((prev) =>
          prev.length >= MAX_IMAGES ? prev : [...prev, url]
        );
      }
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : "Image upload failed.",
        "error"
      );
    } finally {
      setUploading(false);
      // Reset so selecting the same file again re-triggers onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAt = (idx: number) =>
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));

  const makeCover = (idx: number) =>
    setImageUrls((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.unshift(moved);
      return next;
    });

  const submit = (v: MenuItemFormValues) => {
    const description = v.description?.trim();
    // Clean drafts → API shape. Drop groups/choices without a name; derive
    // min/max from required + single/multiple. Sent as a full-replace.
    const optionGroups = groups
      .map((g) => {
        const choices = g.choices
          .map((c) => ({ name: c.name.trim(), priceDelta: Math.max(0, Number(c.price) || 0) }))
          .filter((c) => c.name.length > 0);
        const maxSelect = g.multiple ? Math.max(1, Math.min(20, parseInt(g.max, 10) || 1)) : 1;
        // Optional → no minimum. Single required → 1. Multi-select required → the
        // staff-set "at least" floor, clamped to [1, maxSelect].
        const minSelect =
          g.multiple && g.required
            ? Math.max(1, Math.min(maxSelect, parseInt(g.min, 10) || 1))
            : g.required
              ? 1
              : 0;
        return {
          name: g.name.trim(),
          required: g.required,
          minSelect,
          maxSelect,
          choices,
        };
      })
      .filter((g) => g.name.length > 0 && g.choices.length > 0);
    onSubmit({
      categoryId: v.categoryId,
      name: v.name,
      description: description ? description : undefined,
      imageUrls,
      tags,
      price: v.price,
      discountType,
      discountValue: discountType ? Number(discountValue) || 0 : 0,
      isAvailable: v.isAvailable,
      posOnly: v.posOnly,
      availableDays: availDays,
      availableFrom: availFrom.trim() || null,
      availableTo: availTo.trim() || null,
      optionGroups,
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <Label htmlFor="item-category">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={categories.length === 0}
            >
              <SelectTrigger id="item-category" onBlur={field.onBlur}>
                <SelectValue
                  placeholder={
                    categories.length === 0
                      ? "No categories yet"
                      : "Choose a category"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError>{errors.categoryId?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="item-name">Name</Label>
        <Input id="item-name" {...register("name")} placeholder="e.g. Nasi Lemak Ayam" />
        <FieldError>{errors.name?.message}</FieldError>
      </div>

      <div>
        <Label htmlFor="item-desc">Description (optional)</Label>
        <Textarea id="item-desc" {...register("description")} />
        <FieldError>{errors.description?.message}</FieldError>
      </div>

      {/* Tags — customer-facing attribute badges (spice level, dietary, …) */}
      <div>
        <Label>Tags (optional)</Label>
        <p className="mb-2 text-sm text-slate-400">
          Shown to customers as badges — e.g. spice level or dietary info.
        </p>
        <MultiCombobox
          value={tags}
          onChange={setTags}
          suggestions={SUGGESTED_TAGS}
          max={MAX_TAGS}
          maxLen={MAX_TAG_LEN}
          placeholder="Select or add tags…"
        />
      </div>

      {/* Images */}
      <div>
        <Label>Images (optional)</Label>
        {imageUrls.length > 0 && (
          <div className="mb-3 grid grid-cols-4 gap-3">
            {imageUrls.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(url)}
                  alt={`Item image ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                {idx === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-lg leading-none text-white transition-colors hover:bg-red-600"
                >
                  ×
                </button>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(idx)}
                    className="absolute inset-x-0 bottom-0 bg-slate-900/70 py-1 text-xs font-semibold text-white opacity-0 transition-opacity hover:bg-slate-900/90 group-hover:opacity-100"
                  >
                    Make cover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {atLimit ? (
          <p className="text-sm text-slate-500">
            Maximum of {MAX_IMAGES} images reached. Remove one to add another.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus />
                  Add image
                </>
              )}
            </Button>
            <span className="text-sm text-slate-400">
              PNG, JPEG, WEBP or GIF · max 5 MB · {imageUrls.length}/{MAX_IMAGES}
            </span>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="item-price">Price (RM)</Label>
        <Input
          id="item-price"
          type="number"
          step="0.01"
          inputMode="decimal"
          {...register("price")}
        />
        <FieldError>{errors.price?.message}</FieldError>
      </div>

      {/* Standing menu discount — shown on the customer menu + charged on order */}
      <div>
        <Label>Discount (optional)</Label>
        <p className="mb-2 text-sm text-slate-400">
          A sale price shown on the customer menu and charged automatically.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(
              [
                ["", "None"],
                ["PERCENT", "% off"],
                ["FIXED", "$ off"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val || "none"}
                type="button"
                onClick={() => {
                  const t = (val || null) as "PERCENT" | "FIXED" | null;
                  setDiscountType(t);
                  if (!t) setDiscountValue("");
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  (discountType ?? "") === val
                    ? "bg-accent-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {discountType && (
            <div className="flex items-center gap-1">
              {discountType === "FIXED" && (
                <span className="text-sm font-medium text-slate-500">$</span>
              )}
              <Input
                type="number"
                min="0"
                step={discountType === "PERCENT" ? "1" : "0.10"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "PERCENT" ? "%" : "RM"}
                className="w-24"
              />
              {discountType === "PERCENT" && (
                <span className="text-sm font-medium text-slate-500">%</span>
              )}
            </div>
          )}
        </div>
        {discountInvalid && (
          <FieldError>
            {discountType === "PERCENT"
              ? "Enter a percentage between 0 and 100"
              : "Enter a discount amount greater than 0"}
          </FieldError>
        )}
        {salePreview != null && !discountInvalid && salePreview < priceNum && (
          <p className="mt-1.5 text-sm font-semibold text-emerald-600">
            Sale price RM {salePreview.toFixed(2)} · {Math.round((1 - salePreview / priceNum) * 100)}%
            off
          </p>
        )}
      </div>

      {/* Option groups — configurable choices (size, spice level, add-ons …).
          Each choice's price adds to the item price when selected. */}
      <div>
        <Label>Options (optional)</Label>
        <p className="mb-2 text-sm text-slate-400">
          Let customers pick variations — size, spice level, add-ons. A choice&apos;s
          price adds to the item price.
        </p>
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.map((g, gi) => (
              <div
                key={gi}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={g.name}
                    onChange={(e) => patchGroup(gi, { name: e.target.value })}
                    placeholder="Group name (e.g. Size, Spice level)"
                    className="flex-1 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeGroup(gi)}
                    aria-label={`Remove group ${gi + 1}`}
                    className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={g.required}
                      onChange={(e) => patchGroup(gi, { required: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                    />
                    Required
                  </label>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                    {(
                      [
                        ["single", "Choose one"],
                        ["multiple", "Choose many"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => patchGroup(gi, { multiple: val === "multiple" })}
                        className={cn(
                          "rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                          (g.multiple ? "multiple" : "single") === val
                            ? "bg-accent-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {g.multiple && (
                    <>
                      {g.required && (
                        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                          At least
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            value={g.min}
                            onChange={(e) => patchGroup(gi, { min: e.target.value })}
                            aria-label="Minimum choices"
                            className="h-9 w-16 bg-white"
                          />
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                        Up to
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={g.max}
                          onChange={(e) => patchGroup(gi, { max: e.target.value })}
                          aria-label="Maximum choices"
                          className="h-9 w-16 bg-white"
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {g.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <Input
                        value={c.name}
                        onChange={(e) => patchChoice(gi, ci, { name: e.target.value })}
                        placeholder="Choice (e.g. Large)"
                        className="min-w-0 flex-1 bg-white"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-slate-500">+RM</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.10"
                          value={c.price}
                          onChange={(e) => patchChoice(gi, ci, { price: e.target.value })}
                          placeholder="0.00"
                          aria-label="Choice price"
                          className="h-10 w-20 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeChoice(gi, ci)}
                        aria-label={`Remove choice ${ci + 1}`}
                        className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addChoice(gi)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add choice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addGroup}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700"
        >
          <Plus className="h-4 w-4" />
          Add option group
        </button>
        {optionsError && <FieldError>{optionsError}</FieldError>}
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setValue("isAvailable", e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
        />
        <span className="text-base font-medium text-slate-700">
          Available (uncheck to mark sold out)
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={!posOnly}
          onChange={(e) => setValue("posOnly", !e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
        />
        <span className="text-base font-medium text-slate-700">
          Visible to customers
          <span className="mt-0.5 block text-sm font-normal text-slate-400">
            Uncheck for a secret, POS-only item — staff can order it, but it won&apos;t appear on the
            customer menu.
          </span>
        </span>
      </label>

      {/* Availability schedule (customer menu) */}
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-base font-medium text-slate-700">Availability schedule</p>
        <p className="mt-0.5 text-sm text-slate-400">
          Limit when this item shows on the customer menu (e.g. a breakfast or happy-hour item).
          All days on + blank times = always available. Staff can still order it in the POS.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={cn(
                "h-9 w-12 rounded-lg border text-sm font-semibold transition-colors",
                availDays.includes(d)
                  ? "border-accent-500 bg-accent-50 text-accent-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {availDays.length === 0 ? "Available every day" : "Only on the highlighted days"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            From
            <Input
              type="time"
              value={availFrom}
              onChange={(e) => setAvailFrom(e.target.value)}
              className="h-9 w-36 bg-white"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            to
            <Input
              type="time"
              value={availTo}
              onChange={(e) => setAvailTo(e.target.value)}
              className="h-9 w-36 bg-white"
            />
          </label>
          {(availFrom || availTo) && (
            <button
              type="button"
              onClick={() => {
                setAvailFrom("");
                setAvailTo("");
              }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Clear times
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting || uploading}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            submitting ||
            uploading ||
            categories.length === 0 ||
            discountInvalid ||
            !!optionsError
          }
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Create item"}
        </Button>
      </div>
    </form>
  );
}
