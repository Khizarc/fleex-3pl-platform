'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
import { createSku, createSkuSchema, type CreateSkuInput } from '@/features/products';

type Result = { ok: true; data: { id: string } } | { ok: false; error: string };

export async function createSkuActionForProduct(
  productId: string,
  clientId: string,
  input: CreateSkuInput,
): Promise<Result> {
  const parsed = createSkuSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant } = await getCurrentStaffContext();
  try {
    const sku = await createSku(tenant, { ...parsed.data, productId });
    revalidatePath(`/warehouse/clients/${clientId}/products/${productId}`);
    return { ok: true, data: { id: sku.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return { ok: false, error: 'A SKU with that code already exists for this client.' };
    }
    if (message.includes('No "Product" record')) {
      return { ok: false, error: 'That product no longer exists.' };
    }
    console.error('createSkuActionForProduct failed', err);
    return { ok: false, error: 'Failed to create SKU. Please try again.' };
  }
}
