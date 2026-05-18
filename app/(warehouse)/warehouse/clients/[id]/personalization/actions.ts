'use server';

// Staff-side personalization-field admin actions, scoped to a specific
// client. Mirror of the portal actions but staff has to declare the
// clientId on each call (matching the existing per-client admin pattern).

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
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
  clientId: string,
  input: CreatePersonalizationFieldInput,
): Promise<CreateResult> {
  if (!clientId) return { ok: false, error: 'Missing client id' };
  const parsed = createPersonalizationFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { tenant } = await getCurrentStaffContext();
  try {
    const field = await createPersonalizationField(tenant, { ...parsed.data, clientId });
    revalidatePath(`/warehouse/clients/${clientId}/personalization`);
    return { ok: true, data: { id: field.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return { ok: false, error: 'A field with that key already exists for this client.' };
    }
    console.error('createPersonalizationFieldAction (staff) failed', err);
    return { ok: false, error: 'Failed to create field. Please try again.' };
  }
}

export async function disablePersonalizationFieldAction(
  clientId: string,
  fieldId: string,
): Promise<SimpleResult> {
  if (!clientId || !fieldId) return { ok: false, error: 'Missing identifiers' };
  const { tenant } = await getCurrentStaffContext();
  try {
    await disablePersonalizationField(tenant, fieldId);
    revalidatePath(`/warehouse/clients/${clientId}/personalization`);
    return { ok: true };
  } catch (err) {
    console.error('disablePersonalizationFieldAction (staff) failed', err);
    return { ok: false, error: 'Failed to disable field.' };
  }
}

export async function enablePersonalizationFieldAction(
  clientId: string,
  fieldId: string,
): Promise<SimpleResult> {
  if (!clientId || !fieldId) return { ok: false, error: 'Missing identifiers' };
  const { tenant } = await getCurrentStaffContext();
  try {
    await enablePersonalizationField(tenant, fieldId);
    revalidatePath(`/warehouse/clients/${clientId}/personalization`);
    return { ok: true };
  } catch (err) {
    console.error('enablePersonalizationFieldAction (staff) failed', err);
    return { ok: false, error: 'Failed to re-enable field.' };
  }
}
