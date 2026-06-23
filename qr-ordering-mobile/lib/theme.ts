// Per-tenant brand accent → CSS variables consumed by the `accent` Tailwind
// colour (see tailwind.config.ts). The variables hold space-separated RGB
// channels ("5 150 105") so Tailwind's `/opacity` modifiers keep working
// (`rgb(var(--accent-rgb) / <alpha-value>)`). From one hex we derive a hover
// (dark) shade, a tint (light) shade, and a readable foreground, so one operator
// setting themes every accent-coloured surface in the customer app.

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const channels = (rgb: number[]) =>
  rgb.map((c) => Math.max(0, Math.min(255, Math.round(c)))).join(" ");

const mix = (rgb: number[], target: number[], amt: number) =>
  rgb.map((c, i) => c + (target[i] - c) * amt);

// WCAG relative luminance — used to pick a readable foreground over the accent.
function luminance([r, g, b]: number[]): number {
  const a = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

// WCAG contrast ratio between two luminances: (Llighter + 0.05) / (Ldarker + 0.05).
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Returns the CSS-variable map for a valid hex, or {} for an invalid/empty value
// (so the default emerald theme from globals.css stays in place).
export function accentVars(hex: string | null | undefined): Record<string, string> {
  const rgb = hex ? parseHex(hex) : null;
  if (!rgb) return {};
  // Pick the foreground (BLACK gray-900 vs WHITE) that yields the higher WCAG
  // contrast ratio against the accent — a real AA decision rather than a
  // luminance threshold, which fails for mid-light brand colours.
  const accentLum = luminance(rgb);
  const darkFg = [17, 24, 39];
  const whiteFg = [255, 255, 255];
  const darkRatio = contrastRatio(accentLum, luminance(darkFg));
  const whiteRatio = contrastRatio(accentLum, luminance(whiteFg));
  return {
    "--accent-rgb": channels(rgb),
    "--accent-dark-rgb": channels(mix(rgb, [0, 0, 0], 0.15)),
    "--accent-light-rgb": channels(mix(rgb, [255, 255, 255], 0.22)),
    "--accent-fg-rgb": darkRatio > whiteRatio ? "17 24 39" : "255 255 255",
  };
}
