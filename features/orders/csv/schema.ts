// CSV row schema for bulk order import (Milestone 1.6).
//
// One row per ORDER LINE. Rows sharing the same non-blank `order_reference`
// group into one multi-line order. Headers are normalized to snake_case
// lowercase before validation, so `Order Reference` / `ORDER_REFERENCE` /
// `order_reference` all match.
//
// `order_reference` is a GROUPING KEY ONLY — it is never persisted. The
// existing 1.5 `createOrder` always generates `ORD-YYYYMMDD-####`. A
// future polish milestone may add a persisted `externalReference` column.

import { z } from 'zod';

export const CSV_HEADERS = [
  'order_reference',
  'ship_to_name',
  'ship_to_line1',
  'ship_to_line2',
  'ship_to_city',
  'ship_to_region',
  'ship_to_postal_code',
  'ship_to_country',
  'customer_note',
  'sku_code',
  'quantity',
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

// Pure row-level validator. Quantity is coerced from string (papaparse
// returns everything as strings by default). Country is normalized to
// uppercase. Optional fields accept empty string and treat it as absent.
export const csvOrderRowSchema = z.object({
  order_reference: z.string().trim().max(120).optional().default(''),
  ship_to_name: z.string().trim().min(1, 'Recipient name is required').max(120),
  ship_to_line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  ship_to_line2: z.string().trim().max(200).optional().default(''),
  ship_to_city: z.string().trim().min(1, 'City is required').max(120),
  ship_to_region: z.string().trim().min(1, 'Region is required').max(120),
  ship_to_postal_code: z.string().trim().min(1, 'Postal code is required').max(20),
  ship_to_country: z
    .string()
    .trim()
    .length(2, 'Country must be a 2-letter ISO code')
    .transform((s) => s.toUpperCase()),
  customer_note: z.string().trim().max(2000).optional().default(''),
  sku_code: z.string().trim().min(1, 'SKU code is required').max(120),
  quantity: z.coerce
    .number({ message: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than zero'),
});

export type CsvOrderRow = z.infer<typeof csvOrderRowSchema>;
