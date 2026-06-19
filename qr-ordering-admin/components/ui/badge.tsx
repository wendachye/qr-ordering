import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      // Color tones used across the admin (status + print badges). Kept as the
      // public API since call sites pass semantic tones, not shadcn variants.
      tone: {
        accent: "border-transparent bg-accent-100 text-accent-800",
        green: "border-transparent bg-green-100 text-green-800",
        red: "border-transparent bg-red-100 text-red-800",
        gray: "border-transparent bg-slate-200 text-slate-700",
        amber: "border-transparent bg-amber-100 text-amber-800",
      },
    },
    defaultVariants: {
      tone: "gray",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
