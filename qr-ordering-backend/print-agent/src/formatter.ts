import { formatTicketDate } from './utils';

export interface KitchenItem {
  name: string;
  quantity: number;
  note?: string | null;
  options?: string[];
}

export interface KitchenPayload {
  orderNumber: number;
  roundNumber?: number;
  sessionNumber?: number;
  tableName: string;
  createdAt: string;
  note?: string | null;
  items: KitchenItem[];
  totalItems: number;
}

/* ----------------------------- ESC/POS commands ----------------------------- */

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  init: Buffer.from([ESC, 0x40]), // ESC @  -> initialize printer
  boldOn: Buffer.from([ESC, 0x45, 0x01]), // ESC E 1
  boldOff: Buffer.from([ESC, 0x45, 0x00]), // ESC E 0
  alignLeft: Buffer.from([ESC, 0x61, 0x00]), // ESC a 0
  alignCenter: Buffer.from([ESC, 0x61, 0x01]), // ESC a 1
  doubleOn: Buffer.from([GS, 0x21, 0x11]), // GS ! 0x11 -> double width + height
  doubleOff: Buffer.from([GS, 0x21, 0x00]), // GS ! 0
  feed: (n: number) => Buffer.from([ESC, 0x64, n]), // ESC d n -> feed n lines
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]), // GS V B 0 -> partial cut
};

// Thermal printers use a single-byte code page. Latin1 covers plain ASCII text
// (item names, notes) which is all the kitchen ticket needs.
function line(s = ''): Buffer {
  return Buffer.from(`${s}\n`, 'latin1');
}

/**
 * Builds the raw ESC/POS byte buffer for a kitchen ticket. No prices, no logo.
 *
 *   TABLE 1
 *   ORDER #1001
 *   DINE IN
 *   03 Jun 2026 12:00 PM
 *   ------------------------------
 *   2x Nasi Lemak Ayam
 *      Note: No cucumber
 *   ...
 *   ORDER NOTE:
 *   No peanuts
 *   ------------------------------
 *   TOTAL ITEMS: 3
 */
export function formatKitchenTicket(payload: KitchenPayload): Buffer {
  // 48 chars = one line on an 80mm printer (ZyWell ZY301). For a 58mm printer
  // set PRINTER_CHARS_PER_LINE=32.
  const width = Number(process.env.PRINTER_CHARS_PER_LINE) || 48;
  const sep = '-'.repeat(width);

  const parts: Buffer[] = [];

  parts.push(CMD.init);

  // Header block (centered)
  parts.push(CMD.alignCenter);
  parts.push(CMD.boldOn, CMD.doubleOn);
  parts.push(line((payload.tableName ?? '').toUpperCase()));
  parts.push(CMD.doubleOff);
  parts.push(line(`ORDER #${payload.orderNumber}`));
  if (payload.roundNumber) parts.push(line(`ROUND ${payload.roundNumber}`));
  parts.push(CMD.boldOff);
  parts.push(line('DINE IN'));
  parts.push(line(formatTicketDate(payload.createdAt)));

  // Body (left aligned)
  parts.push(CMD.alignLeft);
  parts.push(line());
  parts.push(line(sep));

  for (const item of payload.items ?? []) {
    parts.push(CMD.boldOn);
    parts.push(line(`${item.quantity}x ${item.name}`));
    parts.push(CMD.boldOff);
    for (const opt of item.options ?? []) {
      parts.push(line(`   ${opt}`));
    }
    if (item.note && item.note.trim()) {
      parts.push(line(`   Note: ${item.note.trim()}`));
    }
    parts.push(line());
  }

  if (payload.note && payload.note.trim()) {
    parts.push(CMD.boldOn);
    parts.push(line('ORDER NOTE:'));
    parts.push(CMD.boldOff);
    parts.push(line(payload.note.trim()));
    parts.push(line());
  }

  parts.push(line(sep));
  parts.push(CMD.boldOn);
  parts.push(line(`TOTAL ITEMS: ${payload.totalItems}`));
  parts.push(CMD.boldOff);

  // Feed and cut
  parts.push(CMD.feed(4));
  parts.push(CMD.cut);

  return Buffer.concat(parts);
}

// Exposed for a dry-run preview (prints the human-readable text, no ESC/POS).
export function renderTicketText(payload: KitchenPayload): string {
  const width = Number(process.env.PRINTER_CHARS_PER_LINE) || 48;
  const sep = '-'.repeat(width);
  const lines: string[] = [
    (payload.tableName ?? '').toUpperCase(),
    `ORDER #${payload.orderNumber}`,
  ];
  if (payload.roundNumber) lines.push(`ROUND ${payload.roundNumber}`);
  lines.push('DINE IN', formatTicketDate(payload.createdAt), '', sep);
  for (const item of payload.items ?? []) {
    lines.push(`${item.quantity}x ${item.name}`);
    for (const opt of item.options ?? []) lines.push(`   ${opt}`);
    if (item.note && item.note.trim()) lines.push(`   Note: ${item.note.trim()}`);
    lines.push('');
  }
  if (payload.note && payload.note.trim()) {
    lines.push('ORDER NOTE:', payload.note.trim(), '');
  }
  lines.push(sep, `TOTAL ITEMS: ${payload.totalItems}`);
  return lines.join('\n');
}
