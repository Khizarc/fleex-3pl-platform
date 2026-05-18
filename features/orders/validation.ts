// Zod schemas for order input. Shared between client forms and server actions
// (defense in depth — server re-validates). Avoid .transform() so the schema
// stays compatible with react-hook-form's zodResolver (same constraint as 1.3).

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

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type AllocateOrderInput = z.infer<typeof allocateOrderInputSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderInputSchema>;
