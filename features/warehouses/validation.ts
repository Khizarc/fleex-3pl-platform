// Zod schemas shared by client forms + server actions (defense-in-depth
// re-validation on the server side).

import { z } from 'zod';

const namePart = z.string().trim().min(1, 'Required').max(120, 'Must be 120 characters or fewer');

export const createWarehouseSchema = z.object({
  name: namePart,
  address: z.string().trim().max(500, 'Address must be 500 characters or fewer').optional(),
});

export const createZoneSchema = z.object({
  warehouseId: z.string().min(1, 'Pick a warehouse'),
  name: namePart,
});

export const createAisleSchema = z.object({
  zoneId: z.string().min(1, 'Pick a zone'),
  name: namePart,
});

export const createBinSchema = z.object({
  aisleId: z.string().min(1, 'Pick an aisle'),
  label: namePart,
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type CreateAisleInput = z.infer<typeof createAisleSchema>;
export type CreateBinInput = z.infer<typeof createBinSchema>;
