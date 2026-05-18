'use server';

// Staff-side per-order actions: allocate (retry from AWAITING_STOCK),
// cancel, and assign (Milestone 1.11).

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { getCurrentStaffContext } from '@/lib/auth';
import { IllegalStateTransitionError, allocateOrder, cancelOrder } from '@/features/orders';
import { CannotAssignTerminalOrderError, InvalidAssigneeError, assignOrder } from '@/features/team';

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

// ADMIN-only: assign an order to a staff member (or null to unassign).
export async function assignOrderAction(
  orderId: string,
  assignedToUserId: string | null,
): Promise<Result> {
  if (!orderId) return { ok: false, error: 'Missing order id' };
  const { tenant, user } = await getCurrentStaffContext();
  if (user.role !== Role.ADMIN) {
    return { ok: false, error: 'Only ADMIN users can assign orders.' };
  }
  try {
    await assignOrder(tenant, { orderId, assignedToUserId });
    revalidatePath('/warehouse/orders');
    revalidatePath(`/warehouse/orders/${orderId}`);
    revalidatePath('/warehouse/pick');
    revalidatePath('/warehouse/pack');
    revalidatePath('/warehouse/ship');
    return { ok: true };
  } catch (err) {
    if (err instanceof CannotAssignTerminalOrderError) {
      return {
        ok: false,
        error: `Cannot change assignment on a ${err.status} order.`,
      };
    }
    if (err instanceof InvalidAssigneeError) {
      return { ok: false, error: err.message };
    }
    console.error('assignOrderAction failed', err);
    return { ok: false, error: 'Failed to assign order. Please try again.' };
  }
}
