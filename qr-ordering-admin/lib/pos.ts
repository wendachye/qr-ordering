// Pure helpers for the staff POS (New Order) screen: cart shape, line pricing,
// default option selection, and required-group validation. Kept framework-free
// so the logic is easy to reason about and reuse.

import type {
  DiscountType,
  OptionGroup,
  PlaceOrderItem,
  PublicMenuItem,
  SessionRound,
} from "./types";

// One selected option on a cart line (for display + price breakdown).
export interface SelectedOption {
  group: string;
  choice: string;
  priceDelta: number;
}

export interface CartLine {
  // Stable id for this cart line (lets the same item appear twice with
  // different options).
  lineId: string;
  menuItemId: string;
  // Custom (open) line: no backing menu item; `name` + `unitPrice` are the
  // source of truth and there are no options.
  custom?: boolean;
  name: string;
  quantity: number;
  note?: string;
  optionChoiceIds: string[];
  options: SelectedOption[];
  // Ad-hoc custom add-ons / special requests (name + price) on this line, e.g.
  // "add 2 eggs" +RM2. They also appear in `options` (for display + pricing);
  // this array is what gets forwarded to the API. Menu items only.
  addons?: { name: string; price: number }[];
  // Per-unit item price = base + sum(selected priceDelta) + add-ons, OR a manual
  // override.
  unitPrice: number;
  // Staff-only extras (admin order entry).
  isTakeaway?: boolean;
  takeawayCharge?: number; // per-unit packaging charge applied (0 if dine-in/waived)
  priceOverridden?: boolean;
  // Manual line discount (PIN-gated): percent or fixed RM off the whole line.
  discountType?: DiscountType;
  discountValue?: number;
}

let lineSeq = 0;
export function nextLineId(): string {
  lineSeq += 1;
  return `line-${lineSeq}-${Date.now()}`;
}

// A custom (open) cart line — staff-entered name + price, no menu item/options.
export function customCartLine(name: string, price: number, quantity = 1): CartLine {
  return {
    lineId: nextLineId(),
    custom: true,
    menuItemId: "",
    name: name.trim(),
    quantity,
    optionChoiceIds: [],
    options: [],
    unitPrice: Math.round(price * 100) / 100,
  };
}

// Pre-select the first choice of each REQUIRED single-select group (maxSelect===1).
// Optional and multi-select groups start empty. Returns a map of groupId -> choiceIds.
export function defaultSelection(
  item: PublicMenuItem
): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  for (const g of item.optionGroups) {
    if (g.required && g.maxSelect === 1 && g.choices.length > 0) {
      sel[g.id] = [g.choices[0].id];
    } else {
      sel[g.id] = [];
    }
  }
  return sel;
}

// Rebuild a selection map (groupId -> choiceIds) from an existing cart line's
// chosen option ids — used to seed the picker when EDITING a line.
export function selectionFromLine(
  item: PublicMenuItem,
  optionChoiceIds: string[]
): Record<string, string[]> {
  const chosen = new Set(optionChoiceIds);
  const sel: Record<string, string[]> = {};
  for (const g of item.optionGroups) {
    sel[g.id] = g.choices.filter((c) => chosen.has(c.id)).map((c) => c.id);
  }
  return sel;
}

// Toggle a choice within a group, honouring single- vs multi-select + the cap.
export function toggleChoice(
  group: OptionGroup,
  current: string[],
  choiceId: string
): string[] {
  if (group.maxSelect === 1) {
    // Radio: selecting replaces; required groups can't be cleared by re-tapping.
    if (current[0] === choiceId) {
      return group.required ? current : [];
    }
    return [choiceId];
  }
  // Checkbox (multi): toggle, capped at maxSelect.
  if (current.includes(choiceId)) {
    return current.filter((id) => id !== choiceId);
  }
  if (current.length >= group.maxSelect) return current; // at cap, ignore
  return [...current, choiceId];
}

// Are all required groups satisfied (at least minSelect chosen)?
export function isSelectionValid(
  item: PublicMenuItem,
  selection: Record<string, string[]>
): boolean {
  return item.optionGroups.every((g) => {
    if (!g.required) return true;
    return (selection[g.id]?.length ?? 0) >= Math.max(1, g.minSelect);
  });
}

// Flatten a selection map into the SelectedOption[] (in group/choice order) used
// for display and the optionChoiceIds payload.
export function selectionToOptions(
  item: PublicMenuItem,
  selection: Record<string, string[]>
): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const g of item.optionGroups) {
    const chosen = selection[g.id] ?? [];
    for (const c of g.choices) {
      if (chosen.includes(c.id)) {
        out.push({ group: g.name, choice: c.name, priceDelta: c.priceDelta });
      }
    }
  }
  return out;
}

// Per-unit price for the given selection. The item's standing menu discount
// (sale price) is the base; options add on top at full value.
export function unitPriceFor(
  item: PublicMenuItem,
  options: SelectedOption[]
): number {
  return options.reduce((sum, o) => sum + o.priceDelta, item.salePrice ?? item.price);
}

// Effective per-unit price including any takeaway packaging charge.
export function lineUnitPrice(l: CartLine): number {
  return l.unitPrice + (l.takeawayCharge ?? 0);
}

// RM discount applied to the whole line (percent or fixed), capped at the line's
// gross value. Mirrors the server-side computation in createOrder.
export function lineDiscountAmount(l: CartLine): number {
  if (!l.discountType || !l.discountValue || l.discountValue <= 0) return 0;
  const gross = lineUnitPrice(l) * l.quantity;
  const raw =
    l.discountType === "PERCENT"
      ? (gross * Math.min(100, l.discountValue)) / 100
      : l.discountValue;
  return Math.round(Math.min(raw, gross) * 100) / 100;
}

export function lineTotal(l: CartLine): number {
  return (
    Math.round((lineUnitPrice(l) * l.quantity - lineDiscountAmount(l)) * 100) / 100
  );
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

// Map a cart line to the API payload for placing an order. Single source of
// truth so every order-entry screen forwards the same staff fields (override,
// takeaway, discount) — keeps the POS and the table workspace in lockstep.
export function cartLineToPlaceOrderItem(l: CartLine): PlaceOrderItem {
  if (l.custom) {
    return {
      customName: l.name,
      customPrice: l.unitPrice,
      quantity: l.quantity,
      note: l.note,
      isTakeaway: l.isTakeaway,
      applyTakeawayCharge: (l.takeawayCharge ?? 0) > 0,
      discountType: l.discountType,
      discountValue: l.discountValue,
    };
  }
  return {
    menuItemId: l.menuItemId,
    quantity: l.quantity,
    note: l.note,
    optionChoiceIds: l.optionChoiceIds,
    addons: l.addons,
    priceOverride: l.priceOverridden ? l.unitPrice : undefined,
    isTakeaway: l.isTakeaway,
    applyTakeawayCharge: (l.takeawayCharge ?? 0) > 0,
    discountType: l.discountType,
    discountValue: l.discountValue,
  };
}

// Rebuild POS cart lines from a past session's items (for "Order again").
// Matches each past item to the current menu by id; skips items no longer on
// the menu / sold out; reconstructs options by NAME within the matched item's
// groups (choice ids aren't stored) and reprices at the CURRENT price.
export function cartLinesFromSession(
  menuItems: PublicMenuItem[],
  rounds: SessionRound[]
): { lines: CartLine[]; skipped: string[] } {
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const lines: CartLine[] = [];
  const skipped: string[] = [];

  for (const round of rounds) {
    if (round.status === "CANCELLED") continue;
    for (const it of round.items) {
      // Custom (open) line — re-add directly with its name + price.
      if (!it.menuItemId) {
        lines.push(customCartLine(it.name, it.unitPrice, it.quantity));
        continue;
      }
      const mi = byId.get(it.menuItemId);
      if (!mi || !mi.isAvailable) {
        skipped.push(it.name);
        continue;
      }
      const optionChoiceIds: string[] = [];
      const options: SelectedOption[] = [];
      const addons: { name: string; price: number }[] = [];
      for (const so of it.selectedOptions) {
        const g = mi.optionGroups.find((gr) => gr.name === so.group);
        const c = g?.choices.find((ch) => ch.name === so.choice);
        if (g && c) {
          optionChoiceIds.push(c.id);
          options.push({ group: g.name, choice: c.name, priceDelta: c.priceDelta });
        } else if (so.group === "Add-on") {
          // A custom add-on (no backing menu choice) — re-add by name + price.
          addons.push({ name: so.choice, price: so.priceDelta });
          options.push({ group: so.group, choice: so.choice, priceDelta: so.priceDelta });
        }
      }
      lines.push({
        lineId: nextLineId(),
        menuItemId: mi.id,
        name: mi.name,
        quantity: it.quantity,
        note: it.note ?? undefined,
        optionChoiceIds,
        options,
        addons: addons.length ? addons : undefined,
        unitPrice: unitPriceFor(mi, options),
      });
    }
  }
  return { lines, skipped };
}
