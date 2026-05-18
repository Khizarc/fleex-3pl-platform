'use server';

// Staff-side per-order actions: allocate (retry from AWAITING_STOCK) and
// cancel (from any allowed status).

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
import { IllegalStateTransitionError, allocateOrder, cancelOrder } from '@/features/orders';

type Result = { ok: true } | { ok: false; error: string };

export async function allocateOrderAction(orderId: string): Promise<Result> {
  if (!orderId) return { ok: false, error: 'Missing order id' };
  const { tenant } = await getCurrentStaffContext();
  try {
    await allocateOrder(tenant, orderId);
    revalidatePath('/warehouse/orders');
    revalidatePath(`/warehouse/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalStateTransitionError) {
      return {
        ok: false,
        error: 'Allocation only runs from SUBMITTED or AWAITING_STOCK.',
      };
    }
    console.error('allocateOrderAction failed', err);
    return { ok: false, error: 'Failed to allocate order. Please try again.' };
  }
}

export async function cancelOrderAction(orderId: string): Promise<Result> {
  if (!orderId) return { ok: false, error: 'Missing order id' };
  const { tenant } = await getCurrentStaffContext();
  try {
    await cancelOrder(tenant, orderId);
    revalidatePath('/warehouse/orders');
    revalidatePath(`/warehouse/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalStateTransitionError) {
      return {
        ok: false,
        error: 'This order cannot be cancelled from its current state.',
      };
    }
    console.error('cancelOrderAction (staff) failed', err);
    return { ok: false, error: 'Failed to cancel order. Please try again.' };
  }
}
