// Single source of truth for client-creation input validation.
// Used by both the server action (defense-in-depth) and the client-side form
// (react-hook-form resolver via @hookform/resolvers/zod).
//
// Empty-string vs undefined handling: the form sends empty strings (because
// HTML inputs default to ''). We treat empty strings as "not provided" — the
// service normalizes them.

import { z } from 'zod';

export const createClientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(120, 'Name must be 120 characters or fewer'),
    firstUserEmail: z.union([z.literal(''), z.email('Invalid email address')]).optional(),
    firstUserName: z.string().trim().max(120, 'Name must be 120 characters or fewer').optional(),
  })
  .refine(
    (data) => {
      const hasEmail = Boolean(data.firstUserEmail);
      const hasName = Boolean(data.firstUserName);
      // Both provided or both empty — never just one.
      return hasEmail === hasName;
    },
    {
      message: 'Provide both email and name to invite a first user, or leave both empty',
      path: ['firstUserEmail'],
    },
  );

export type CreateClientInput = z.infer<typeof createClientSchema>;

// Schema for inviting an additional portal user to an existing client.
// Both email and name are required (unlike createClient where they're optional).
export const inviteClientUserSchema = z.object({
  email: z.email('Enter a valid email address'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(120, 'Name must be 120 characters or fewer'),
});

export type InviteClientUserInput = z.infer<typeof inviteClientUserSchema>;
