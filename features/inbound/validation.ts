// Zod schemas for inbound-shipment input. Shared between client forms and
// server actions (defense in depth — server re-validates).

import { z } from 'zod';

const positiveInt = z
  .number({ message: 'Quantity must be a number' })
  .int('Quantity must be a whole number')
  .positive('Quantity must be greater than zero');

export const inboundLineInputSchema = z.object({
  skuId: z.string().min(1, 'Pick a SKU'),
  expectedQuantity: positiveInt,
});

export const createInboundShipmentSchema = z.object({
  warehouseId: z.string().min(1, 'Pick a destination warehouse'),
  reference: z.string().trim().max(120, 'Reference must be 120 characters or fewer').optional(),
  // YYYY-MM-DD or empty. Service converts to Date.
  expectedArrivalAt: z.string().optional(),
  notes: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer').optional(),
  lines: z.array(inboundLineInputSchema).min(1, 'Add at least one line'),
});

export const receiveLineSchema = z.object({
  lineId: z.string().min(1),
  actualQuantity: positiveInt,
  binId: z.string().min(1, 'Pick a bin'),
  notes: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer').optional(),
  damaged: z.boolean().optional(),
});

export type CreateInboundShipmentInput = z.infer<typeof createInboundShipmentSchema>;
export type ReceiveLineInput = z.infer<typeof receiveLineSchema>;
export type InboundLineInput = z.infer<typeof inboundLineInputSchema>;
