'use server';

// Server action: thin wrapper around `features/clients/createClient`.
// Re-validates input with the same zod schema the client used (defense in
// depth) and revalidates the clients route on success.

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
import { createClient, createClientSchema, type CreateClientInput } from '@/features/clients';

type ActionResult = { ok: true; clientId: string } | { ok: false; error: string };

export async function createClientAction(input: CreateClientInput): Promise<ActionResult> {
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant } = await getCurrentStaffContext();

  try {
    const created = await createClient(tenant, parsed.data);
    revalidatePath('/warehouse/clients');
    return { ok: true, clientId: created.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { ok: false, error: 'A client with that name already exists' };
    }
    console.error('createClientAction failed', err);
    return { ok: false, error: 'Failed to create client. Please try again.' };
  }
}
