"use client";

import { cn } from "@/lib/cn";

// Compact +/- quantity stepper with large touch targets (iPad-friendly).
// Clamps to [min, max] (defaults 1..99, matching the order API's 1..99 rule).
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn =
    size === "sm"
      ? "h-9 w-9 text-lg"
      : "h-11 w-11 text-2xl";
  const num = size === "sm" ? "w-8 text-base" : "w-10 text-xl";

  const Step = ({
    label,
    delta,
    disabled,
  }: {
    label: string;
    delta: number;
    disabled: boolean;
  }) => (
    <button
      type="button"
      aria-label={delta > 0 ? "Increase quantity" : "Decrease quantity"}
      disabled={disabled}
      onClick={() => onChange(clamp(value + delta))}
      className={cn(
        "flex items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
        btn
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-1 inline-flex items-center gap-2">
      <Step label="−" delta={-1} disabled={value <= min} />
      <span className={cn("text-center font-bold text-slate-900", num)}>
        {value}
      </span>
      <Step label="+" delta={1} disabled={value >= max} />
    </div>
  );
}
