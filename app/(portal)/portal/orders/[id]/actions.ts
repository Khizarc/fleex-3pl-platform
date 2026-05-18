'use server';

// Portal: client cancels their own order. RLS scopes the cancel to the
// caller's client; another client can't target an order they didn't create.

import { revalidatePath } from 'next/cache';
import { getCurrentClientContext } from '@/lib/auth';
import { IllegalStateTransitionError, cancelOrder } from '@/features/orders';

type Result = { ok: true } | { ok: false; error: string };

export async function cancelOrderAction(orderId: string): Promise<Result> {
  if (!orderId) return { ok: false, error: 'Missing order id' };

  const { tenant } = await getCurrentClientContext();
  try {
    await cancelOrder(tenant, orderId);
    revalidatePath('/portal/orders');
    revalidatePath(`/portal/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalStateTransitionError) {
      return {
        ok: false,
        error: 'This order cannot be cancelled from its current state.',
      };
    }
    console.error('cancelOrderAction (portal) failed', err);
    return { ok: false, error: 'Failed to cancel order. Please try again.' };
  }
}
