'use server';

// Portal-side server action. The current client context (resolved from the
// authenticated ClientUser) determines which client's catalog this writes into
// — a portal user can ONLY ever create products under their own client.

import { revalidatePath } from 'next/cache';
import { getCurrentClientContext } from '@/lib/auth';
import { createProduct, createProductSchema, type CreateProductInput } from '@/features/products';

type Result = { ok: true; data: { id: string } } | { ok: false; error: string };

export async function createProductAction(input: CreateProductInput): Promise<Result> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, client } = await getCurrentClientContext();
  try {
    const product = await createProduct(tenant, { ...parsed.data, clientId: client.id });
    revalidatePath('/portal/products');
    return { ok: true, data: { id: product.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('Unique constraint')) {
      return { ok: false, error: 'A product with that name already exists in your catalog.' };
    }
    console.error('createProductAction failed', err);
    return { ok: false, error: 'Failed to create product. Please try again.' };
  }
}
