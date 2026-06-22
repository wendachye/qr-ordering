// Item availability windows. The venue runs in its own local timezone (a business
// day is the local calendar day, matching the reports), so "now" is the local
// wall clock. Empty days = every day; null from/to = all day; a window may wrap
// past midnight (from > to, e.g. 22:00–02:00 late-night menu).

export type AvailabilityWindow = {
  availableDays: number[]; // 0=Sun .. 6=Sat; empty = every day
  availableFrom: string | null; // "HH:MM"
  availableTo: string | null; // "HH:MM"
};

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** True when an item is orderable / visible at `now` per its schedule window. */
export function isItemAvailableNow(item: AvailabilityWindow, now: Date = new Date()): boolean {
  // Day-of-week gate.
  if (item.availableDays.length > 0 && !item.availableDays.includes(now.getDay())) {
    return false;
  }
  // Time-of-day gate — only when both ends are set and valid.
  if (!item.availableFrom || !item.availableTo) return true;
  const start = toMinutes(item.availableFrom);
  const end = toMinutes(item.availableTo);
  if (start == null || end == null || start === end) return true; // all-day / malformed
  const cur = now.getHours() * 60 + now.getMinutes();
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}
