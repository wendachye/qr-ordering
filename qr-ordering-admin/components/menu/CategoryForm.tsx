"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import type { Category, CategoryInput } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof schema>;

export function CategoryForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Category;
  submitting: boolean;
  onSubmit: (values: CategoryInput) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      isActive: initial?.isActive ?? true,
    },
  });

  const isActive = watch("isActive");

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v))} className="space-y-4">
      <div>
        <Label htmlFor="cat-name">Name</Label>
        <Input id="cat-name" {...register("name")} placeholder="e.g. Desserts" />
        <FieldError>{errors.name?.message}</FieldError>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setValue("isActive", e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
        />
        <span className="text-base font-medium text-slate-700">Active</span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : initial ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  );
}
