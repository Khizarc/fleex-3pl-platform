// Zod schemas for the PersonalizationField CRUD surface. Shared between
// client-side forms and server actions (defense in depth — server re-parses).
//
// `key` regex matches the CSV header normalization in features/orders/csv/
// (lowercase + snake_case): a definition can always appear as a column
// `personalization_<key>` in the bulk import flow.

import { z } from 'zod';

export const PERSONALIZATION_KEY_REGEX = /^[a-z][a-z0-9_]{0,49}$/;

export const createPersonalizationFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .regex(
      PERSONALIZATION_KEY_REGEX,
      'Key must start with a lowercase letter and contain only lowercase letters, digits, or underscores (max 50 chars).',
    ),
  label: z.string().trim().min(1, 'Label is required').max(120),
  description: z.string().trim().max(500).optional(),
  required: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

// Update: key is NOT editable once the field exists. Service layer will
// additionally reject changes if any captured values reference the field.
export const updatePersonalizationFieldSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const personalizationValueSchema = z.string().max(500);

// Use `z.input` so optional-with-default fields stay optional on the caller's
// side. The service applies the same defaults explicitly (`required ?? false`)
// so the boundary is consistent whether input arrives from a form, an action,
// or a test fixture.
export type CreatePersonalizationFieldInput = z.input<typeof createPersonalizationFieldSchema>;
export type UpdatePersonalizationFieldInput = z.input<typeof updatePersonalizationFieldSchema>;
