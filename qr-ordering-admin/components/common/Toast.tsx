"use client";

import { toast as sonnerToast } from "sonner";

type ToastKind = "success" | "error" | "info";

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

// Backed by Sonner (rendered by <Toaster/> in providers). Kept as a `useToast()`
// hook returning `toast(message, kind)` so the ~25 existing call sites need no
// change while the actual toasts are Sonner's.
export function useToast(): ToastContextValue {
  return {
    toast: (message: string, kind: ToastKind = "info") => {
      if (kind === "success") sonnerToast.success(message);
      else if (kind === "error") sonnerToast.error(message);
      else sonnerToast(message);
    },
  };
}
