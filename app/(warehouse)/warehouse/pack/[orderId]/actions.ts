'use server';

// Staff-only action: pack an order. Role gate ADMIN | PACKER; suspended
// users rejected. Calls packOrder service then revalidates the affected paths.

import { revalidatePath } from 'next/cache';
import { AccountStatus, Role } from '@prisma/client';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  IllegalStateTransitionError,
  OrderAlreadyPackedError,
  packOrder,
  packOrderInputSchema,
  type PackOrderInput,
} from '@/features/orders';

type Result = { ok: true } | { ok: false; error: string };

export async function packOrderAction(input: PackOrderInput): Promise<Result> {
  const parsed = packOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, user } = await getCurrentStaffContext();
  if (user.status !== AccountStatus.ACTIVE) {
    return { ok: false, error: 'Your account is not active.' };
  }
  if (user.role !== Role.ADMIN && user.role !== Role.PACKER) {
    return { ok: false, error: 'You do not have permission to pack.' };
  }

  try {
    await packOrder(tenant, {
      orderId: parsed.data.orderId,
      boxLengthMm: parsed.data.boxLengthMm,
      boxWidthMm: parsed.data.boxWidthMm,
      boxHeightMm: parsed.data.boxHeightMm,
      boxWeightG: parsed.data.boxWeightG,
      packNotes: parsed.data.packNotes,
      packedByUserId: user.id,
    });
    revalidatePath('/warehouse/pack');
    revalidatePath(`/warehouse/pack/${parsed.data.orderId}`);
    revalidatePath(`/warehouse/orders/${parsed.data.orderId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalStateTransitionError) {
      return { ok: false, error: 'This order is no longer in a packable state.' };
    }
    if (err instanceof OrderAlreadyPackedError) {
      return { ok: false, error: 'This order has already been packed by someone else.' };
    }
    console.error('packOrderAction failed', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Failed to pack order: ${message}` };
  }
}
