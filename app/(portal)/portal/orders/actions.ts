'use server';

// Portal server action: a client places an order.
// Client context resolved from the authenticated ClientUser.

import { revalidatePath } from 'next/cache';
import { getCurrentClientContext } from '@/lib/auth';
import {
  IllegalStateTransitionError,
  createOrder,
  createOrderInputSchema,
  type CreateOrderInput,
} from '@/features/orders';

type Result = { ok: true; data: { id: string } } | { ok: false; error: string };

export async function createOrderAction(input: CreateOrderInput): Promise<Result> {
  const parsed = createOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, client, clientUser } = await getCurrentClientContext();
  try {
    const order = await createOrder(tenant, {
      ...parsed.data,
      clientId: client.id,
      createdByClientUserId: clientUser.id,
    });
    revalidatePath('/portal/orders');
    return { ok: true, data: { id: order.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (err instanceof IllegalStateTransitionError) {
      return { ok: false, error: 'Order is no longer in a state that can be modified.' };
    }
    if (message.includes('do not belong to this client')) {
      return { ok: false, error: 'One or more SKUs do not belong to your account.' };
    }
    console.error('createOrderAction failed', err);
    return { ok: false, error: 'Failed to create order. Please try again.' };
  }
}
