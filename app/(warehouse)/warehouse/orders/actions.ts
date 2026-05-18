'use server';

// Staff-side server actions for orders: create on behalf of a client.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  IllegalStateTransitionError,
  createOrder,
  createOrderInputSchema,
  type CreateOrderInput,
} from '@/features/orders';

type Result = { ok: true; data: { id: string } } | { ok: false; error: string };

const staffInputSchema = createOrderInputSchema.extend({
  clientId: z.string().min(1, 'Pick a client'),
});

export type StaffCreateOrderInput = CreateOrderInput & { clientId: string };

export async function createOrderAction(input: StaffCreateOrderInput): Promise<Result> {
  const parsed = staffInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, user } = await getCurrentStaffContext();
  try {
    const order = await createOrder(tenant, {
      ...parsed.data,
      createdByUserId: user.id,
    });
    revalidatePath('/warehouse/orders');
    return { ok: true, data: { id: order.id } };
  } catch (err) {
    if (err instanceof IllegalStateTransitionError) {
      return { ok: false, error: 'Order is no longer in a state that can be modified.' };
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('do not belong to this client')) {
      return { ok: false, error: 'One or more SKUs do not belong to the chosen client.' };
    }
    if (message.includes('No "Client" record')) {
      return { ok: false, error: 'That client is no longer available.' };
    }
    console.error('createOrderAction (staff) failed', err);
    return { ok: false, error: 'Failed to create order. Please try again.' };
  }
}
