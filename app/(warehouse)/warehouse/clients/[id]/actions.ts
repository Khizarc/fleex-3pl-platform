'use server';

// Staff-side server action for creating a product belonging to a specific client.
// `clientId` is captured in a closure at action-binding time (see the page that
// calls it) — the client form just submits the validated input shape.

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
import { createProduct, createProductSchema, type CreateProductInput } from '@/features/products';
import {
  ClientUserAlreadyExistsError,
  inviteClientUser,
  inviteClientUserSchema,
  type InviteClientUserInput,
} from '@/features/clients';

type Result = { ok: true; data: { id: string } } | { ok: false; error: string };

export async function createProductActionForClient(
  clientId: string,
  input: CreateProductInput,
): Promise<Result> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant } = await getCurrentStaffContext();
  try {
    const product = await createProduct(tenant, { ...parsed.data, clientId });
    revalidatePath(`/warehouse/clients/${clientId}`);
    return { ok: true, data: { id: product.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return { ok: false, error: 'A product with that name already exists for this client.' };
    }
    if (message.includes('No "Client" record')) {
      return { ok: false, error: 'That client no longer exists.' };
    }
    console.error('createProductActionForClient failed', err);
    return { ok: false, error: 'Failed to create product. Please try again.' };
  }
}

type InviteResult = { ok: true } | { ok: false; error: string };

export async function inviteClientUserAction(
  clientId: string,
  input: InviteClientUserInput,
): Promise<InviteResult> {
  const parsed = inviteClientUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant } = await getCurrentStaffContext();
  try {
    await inviteClientUser(tenant, { clientId, ...parsed.data });
    revalidatePath(`/warehouse/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ClientUserAlreadyExistsError) {
      return { ok: false, error: err.message };
    }
    console.error('inviteClientUserAction failed', err);
    return { ok: false, error: 'Failed to invite portal user. Please try again.' };
  }
}
