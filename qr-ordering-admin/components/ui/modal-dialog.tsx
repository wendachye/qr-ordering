"use client";

import { type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Controlled modal built on the real Radix Dialog, preserving the previous
 * hand-rolled `<Dialog open onClose title>` API so existing call sites only
 * need an import swap. Radix gives us focus-trapping, Escape handling, scroll
 * lock and animations for free.
 */
export function ModalDialog({
  open,
  onClose,
  title,
  children,
  className,
}: ModalDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={cn("max-h-[90vh] overflow-y-auto", className)}
      >
        <DialogHeader>
          {/* A title is always rendered for accessibility; hidden visually when
              the caller doesn't supply one. */}
          <DialogTitle className={cn(!title && "sr-only")}>
            {title ?? "Dialog"}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
