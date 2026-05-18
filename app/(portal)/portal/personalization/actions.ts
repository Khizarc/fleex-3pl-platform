'use server';

// Portal-side personalization-field admin actions.

import { revalidatePath } from 'next/cache';
import { getCurrentClientContext } from '@/lib/auth';
import {
  createPersonalizationField,
  createPersonalizationFieldSchema,
  disablePersonalizationField,
  enablePersonalizationField,
  type CreatePersonalizationFieldInput,
} from '@/features/personalization';

type CreateResult = { ok: true; data: { id: string } } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

export async function createPersonalizationFieldAction(
  input: CreatePersonalizationFieldInput,
): Promise<CreateResult> {
  const parsed = createPersonalizationFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { tenant, client } = await getCurrentClientContext();
  try {
    const field = await createPersonalizationField(tenant, {
      ...parsed.data,
      clientId: client.id,
    });
    revalidatePath('/portal/personalization');
    return { ok: true, data: { id: field.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return { ok: false, error: 'A field with that key already exists.' };
    }
    console.error('createPersonalizationFieldAction failed', err);
    return { ok: false, error: 'Failed to create field. Please try again.' };
  }
}

export async function disablePersonalizationFieldAction(fieldId: string): Promise<SimpleResult> {
  if (!fieldId) return { ok: false, error: 'Missing field id' };
  const { tenant } = await getCurrentClientContext();
  try {
    await disablePersonalizationField(tenant, fieldId);
    revalidatePath('/portal/personalization');
    return { ok: true };
  } catch (err) {
    console.error('disablePersonalizationFieldAction failed', err);
    return { ok: false, error: 'Failed to disable field.' };
  }
}

export async function enablePersonalizationFieldAction(fieldId: string): Promise<SimpleResult> {
  if (!fieldId) return { ok: false, error: 'Missing field id' };
  const { tenant } = await getCurrentClientContext();
  try {
    await enablePersonalizationField(tenant, fieldId);
    revalidatePath('/portal/personalization');
    return { ok: true };
  } catch (err) {
    console.error('enablePersonalizationFieldAction failed', err);
    return { ok: false, error: 'Failed to re-enable field.' };
  }
}
