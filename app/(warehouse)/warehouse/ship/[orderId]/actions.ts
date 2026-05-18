'use server';

// Staff-only action: ship an order (manual label entry). Role gate
// ADMIN | SHIPPER; suspended users rejected. Calls shipOrder service then
// revalidates all the paths the order detail appears on.

import { revalidatePath } from 'next/cache';
import { AccountStatus, Role } from '@prisma/client';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  IllegalStateTransitionError,
  OrderAlreadyShippedError,
  shipOrder,
  shipOrderInputSchema,
  type ShipOrderInput,
} from '@/features/orders';

type Result = { ok: true } | { ok: false; error: string };

export async function shipOrderAction(input: ShipOrderInput): Promise<Result> {
  const parsed = shipOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, user } = await getCurrentStaffContext();
  if (user.status !== AccountStatus.ACTIVE) {
    return { ok: false, error: 'Your account is not active.' };
  }
  if (user.role !== Role.ADMIN && user.role !== Role.SHIPPER) {
    return { ok: false, error: 'You do not have permission to ship.' };
  }

  try {
    await shipOrder(tenant, {
      orderId: parsed.data.orderId,
      carrier: parsed.data.carrier,
      carrierOther: parsed.data.carrierOther,
      trackingNumber: parsed.data.trackingNumber,
      shipNotes: parsed.data.shipNotes,
      shippedByUserId: user.id,
    });
    revalidatePath('/warehouse/ship');
    revalidatePath(`/warehouse/ship/${parsed.data.orderId}`);
    revalidatePath(`/warehouse/orders/${parsed.data.orderId}`);
    revalidatePath(`/portal/orders/${parsed.data.orderId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalStateTransitionError) {
      return { ok: false, error: 'This order is no longer in a shippable state.' };
    }
    if (err instanceof OrderAlreadyShippedError) {
      return { ok: false, error: 'This order has already been shipped by someone else.' };
    }
    console.error('shipOrderAction failed', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Failed to ship order: ${message}` };
  }
}
