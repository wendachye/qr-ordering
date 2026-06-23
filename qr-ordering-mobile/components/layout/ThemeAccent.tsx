"use client";

import { useEffect } from "react";
import { accentVars } from "@/lib/theme";

/**
 * Applies the tenant outlet's brand accent as CSS variables on :root, so every
 * `accent`-coloured surface — including portaled modals and the sticky cart bar
 * — themes from one value. A null/invalid colour leaves the default emerald
 * theme (defined in globals.css) untouched. Renders nothing.
 */
export function ThemeAccent({ color }: { color?: string | null }) {
  useEffect(() => {
    const vars = accentVars(color);
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  }, [color]);

  return null;
}
