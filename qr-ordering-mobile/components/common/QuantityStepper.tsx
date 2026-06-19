"use client";

/**
 * Reusable +/- quantity stepper. Clamps between `min` and `max`.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg font-bold text-black disabled:opacity-40"
      >
        −
      </button>
      <span className="w-6 text-center text-base font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg font-bold text-black disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
