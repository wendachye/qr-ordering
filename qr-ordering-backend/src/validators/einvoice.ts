import { z } from 'zod';

const optStr = (max: number) => z.string().trim().max(max).nullable().optional();

// Seller details + the e-Invoice toggle (Settings → e-Invoice).
export const einvoiceSettingsSchema = z
  .object({
    einvoiceEnabled: z.boolean().optional(),
    einvoiceMode: z.enum(['sandbox', 'production']).optional(),
    sellerTin: optStr(50),
    sellerRegistrationNo: optStr(50),
    sellerSstNo: optStr(50),
    sellerMsic: optStr(20),
    sellerAddress: optStr(300),
    sellerEmail: optStr(200),
    sellerPhone: optStr(50),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// Buyer details captured at invoice issue. All optional — a B2C invoice may omit
// the buyer; B2B should provide at least the buyer's name + TIN.
export const issueInvoiceSchema = z.object({
  buyerName: optStr(200),
  buyerTin: optStr(50),
  buyerRegistrationNo: optStr(50),
  buyerEmail: optStr(200),
  buyerPhone: optStr(50),
  buyerAddress: optStr(300),
});

export type EinvoiceSettingsInput = z.infer<typeof einvoiceSettingsSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
