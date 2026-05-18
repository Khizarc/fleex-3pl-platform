// Zod schemas shared by client forms + server actions (defense-in-depth
// re-validation on the server side).

import { z } from 'zod';

const required = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(120, `${label} must be 120 characters or fewer`);

export const createProductSchema = z.object({
  name: required('Name'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional(),
});

export const createSkuSchema = z.object({
  code: required('Code'),
  name: required('Name'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateSkuInput = z.infer<typeof createSkuSchema>;
