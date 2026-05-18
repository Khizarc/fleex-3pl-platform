'use server';

// Staff-only action: confirm a single bin pick.
// Role gate: only ADMIN or PICKER may run this. Suspended users blocked.

import { revalidatePath } from 'next/cache';
import { AccountStatus, Role } from '@prisma/client';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  AllocationAlreadyPickedError,
  BinLabelMismatchError,
  BinNotActiveError,
  IllegalStateTransitionError,
  pickAllocation,
  pickAllocationInputSchema,
  type PickAllocationInput,
} from '@/features/orders';

type Result = { ok: true } | { ok: false; error: string };

export async function pickAllocationAction(
  orderId: string,
  input: PickAllocationInput,
): Promise<Result> {
  if (!orderId) return { ok: false, error: 'Missing order id' };
  const parsed = pickAllocationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, user } = await getCurrentStaffContext();
  if (user.status !== AccountStatus.ACTIVE) {
    return { ok: false, error: 'Your account is not active.' };
  }
  if (user.role !== Role.ADMIN && user.role !== Role.PICKER) {
    return { ok: false, error: 'You do not have permission to pick.' };
  }

  try {
    await pickAllocation(tenant, {
      allocationId: parsed.data.allocationId,
      scannedBinLabel: parsed.data.scannedBinLabel,
      pickedByUserId: user.id,
    });
    revalidatePath('/warehouse/pick');
    revalidatePath(`/warehouse/pick/${orderId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof BinLabelMismatchError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof AllocationAlreadyPickedError) {
      return { ok: false, error: 'This allocation has already been picked.' };
    }
    if (err instanceof BinNotActiveError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof IllegalStateTransitionError) {
      return { ok: false, error: 'This order is no longer in a pickable state.' };
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('pickAllocationAction failed', err);
    return { ok: false, error: `Failed to confirm pick: ${message}` };
  }
}
