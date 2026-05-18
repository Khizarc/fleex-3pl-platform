'use server';

// Staff server actions for the receive workflow. Each one resolves the
// staff context, calls the service, and revalidates the detail page.

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  IllegalStateTransitionError,
  completeInboundShipment,
  receiveLine,
  receiveLineSchema,
  startReceiving,
  type ReceiveLineInput,
} from '@/features/inbound';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  if (err instanceof IllegalStateTransitionError) {
    return `Cannot make that transition (currently ${err.from}).`;
  }
  if (msg.includes('have not been received yet')) {
    return msg;
  }
  if (msg.includes('Bin must be in the shipment')) {
    return 'Pick a bin inside the destination warehouse.';
  }
  console.error('inbound action failed', err);
  return 'Something went wrong. Please try again.';
}

export async function startReceivingAction(shipmentId: string): Promise<Result> {
  const { tenant } = await getCurrentStaffContext();
  try {
    await startReceiving(tenant, shipmentId);
    revalidatePath(`/warehouse/inbound-shipments/${shipmentId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function receiveLineAction(input: ReceiveLineInput): Promise<Result> {
  const parsed = receiveLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { tenant, user } = await getCurrentStaffContext();
  try {
    const line = await receiveLine(tenant, { ...parsed.data, receivedByUserId: user.id });
    revalidatePath(`/warehouse/inbound-shipments/${line.inboundShipmentId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function completeAction(shipmentId: string): Promise<Result> {
  const { tenant } = await getCurrentStaffContext();
  try {
    await completeInboundShipment(tenant, shipmentId);
    revalidatePath(`/warehouse/inbound-shipments/${shipmentId}`);
    revalidatePath('/warehouse/inbound-shipments');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
