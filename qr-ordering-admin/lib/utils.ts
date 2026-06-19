import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui class merge helper: combines clsx (conditional classes) with
// tailwind-merge (de-duplicates conflicting Tailwind utilities).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
