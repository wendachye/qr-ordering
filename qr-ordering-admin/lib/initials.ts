// 1–2 letter initials for an avatar fallback: "Test Waiter" → "TW", an email
// with no name → its first two letters. Shared by the staff list and the header
// account menu.
export function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
}
