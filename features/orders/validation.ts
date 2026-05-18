// Zod schemas for order input. Shared between client forms and server actions
// (defense in depth — server re-validates). Avoid .transform() so the schema
// stays compatible with react-hook-form's zodResolver (same constraint as 1.3).

import { Carrier } from '@prisma/client';
import { z } from 'zod';

const positiveInt = z
  .number({ message: 'Quantity must be a number' })
  .int('Quantity must be a whole number')
  .positive('Quantity must be greater than zero');

const trimmedString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const orderLineInputSchema = z.object({
  skuId: z.string().min(1, 'Pick a SKU'),
  quantity: positiveInt,
  // Optional per-line personalization values. Keys must match an ACTIVE
  // PersonalizationField for the client (enforced at service layer). Values
  // capped at 500 chars; empty strings are dropped (treated as absent).
  personalization: z.record(z.string(), z.string().max(500)).optional(),
});

export const createOrderInputSchema = z.object({
  shipToName: trimmedString(120, 'Recipient name'),
  shipToLine1: trimmedString(200, 'Address line 1'),
  shipToLine2: z
    .string()
    .trim()
    .max(200, 'Address line 2 must be 200 characters or fewer')
    .optional(),
  shipToCity: trimmedString(120, 'City'),
  shipToRegion: trimmedString(120, 'State / region'),
  shipToPostalCode: trimmedString(20, 'Postal code'),
  // Two-letter ISO country code (e.g. "US"). UI normalizes case before submit.
  shipToCountry: z.string().trim().length(2, 'Country must be a 2-letter ISO code'),
  customerNote: z.string().trim().max(2000, 'Note must be 2000 characters or fewer').optional(),
  lines: z.array(orderLineInputSchema).min(1, 'Add at least one line'),
});

export const allocateOrderInputSchema = z.object({
  orderId: z.string().min(1),
});

export const cancelOrderInputSchema = z.object({
  orderId: z.string().min(1),
});

export const pickAllocationInputSchema = z.object({
  allocationId: z.string().min(1, 'Allocation id is required'),
  scannedBinLabel: z.string().trim().min(1, 'Type or scan the bin label to confirm').max(120),
});

// Pack input (Milestone 1.9). Dimensions are millimeters, weight is grams —
// the canonical units. The pack form converts inches/ounces to these before
// posting. Sanity caps catch the cm-as-inches footgun without being absurd:
// 3 m max box edge, 500 kg pallet-class max weight.
const dimMm = z
  .number({ message: 'Dimension must be a number' })
  .int('Dimension must be a whole number of mm')
  .positive('Dimension must be greater than zero')
  .max(3_000, 'Dimension exceeds the 3000 mm sanity cap');
const weightG = z
  .number({ message: 'Weight must be a number' })
  .int('Weight must be a whole number of grams')
  .positive('Weight must be greater than zero')
  .max(500_000, 'Weight exceeds the 500 kg sanity cap');

export const packOrderInputSchema = z.object({
  orderId: z.string().min(1, 'Order id is required'),
  boxLengthMm: dimMm,
  boxWidthMm: dimMm,
  boxHeightMm: dimMm,
  boxWeightG: weightG,
  packNotes: z.string().trim().max(2000).optional(),
});

// Ship input (Milestone 1.10). Manual label entry: carrier dropdown +
// tracking number + optional ship notes. `carrierOther` is required only
// when `carrier === OTHER` (the long-tail escape hatch).
export const shipOrderInputSchema = z
  .object({
    orderId: z.string().min(1, 'Order id is required'),
    carrier: z.nativeEnum(Carrier),
    carrierOther: z.string().trim().max(60).optional(),
    trackingNumber: z
      .string()
      .trim()
      .min(1, 'Tracking number is required')
      .max(120, 'Tracking number is too long'),
    shipNotes: z.string().trim().max(2000).optional(),
  })
  .refine(
    (d) => d.carrier !== Carrier.OTHER || (d.carrierOther && d.carrierOther.trim().length > 0),
    {
      message: 'Specify the carrier name when "Other" is selected',
      path: ['carrierOther'],
    },
  );

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type AllocateOrderInput = z.infer<typeof allocateOrderInputSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderInputSchema>;
export type PickAllocationInput = z.infer<typeof pickAllocationInputSchema>;
export type PackOrderInput = z.infer<typeof packOrderInputSchema>;
export type ShipOrderInput = z.infer<typeof shipOrderInputSchema>;
