/**
 * Shared shape of the data stored on PrintJob.payload and consumed by the
 * local print agent. Order creation and reprint both build this so the kitchen
 * ticket always looks the same.
 */
export interface KitchenTicketItem {
  name: string;
  quantity: number;
  note?: string | null;
  // Selected options as display strings, e.g. ["Cooking method: Teriyaki"].
  options?: string[];
  takeaway?: boolean;
}

export interface KitchenTicketPayload {
  orderNumber: number;
  // Round index within the table's running session (1 = first round). Optional
  // so older/pre-session payloads still deserialize.
  roundNumber?: number;
  sessionNumber?: number;
  tableName: string;
  createdAt: string; // ISO string
  note?: string | null;
  items: KitchenTicketItem[];
  totalItems: number;
}

export function buildKitchenPayload(input: {
  orderNumber: number;
  roundNumber?: number;
  sessionNumber?: number;
  tableName: string;
  createdAt: Date;
  note?: string | null;
  items: {
    name: string;
    quantity: number;
    note?: string | null;
    options?: string[];
    takeaway?: boolean;
  }[];
}): KitchenTicketPayload {
  const items = input.items.map((it) => {
    const baseNote = it.note?.trim() ? it.note.trim() : null;
    return {
      name: it.name,
      quantity: it.quantity,
      // Surface takeaway on the ticket itself so the kitchen packs it.
      note: it.takeaway ? [baseNote, '(Takeaway)'].filter(Boolean).join(' ') : baseNote,
      options: it.options ?? [],
      takeaway: !!it.takeaway,
    };
  });

  return {
    orderNumber: input.orderNumber,
    roundNumber: input.roundNumber,
    sessionNumber: input.sessionNumber,
    tableName: input.tableName,
    createdAt: input.createdAt.toISOString(),
    note: input.note ?? null,
    items,
    totalItems: items.reduce((sum, it) => sum + it.quantity, 0),
  };
}
