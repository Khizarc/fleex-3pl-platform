'use server';

// Portal server action: a client creates an inbound shipment notice.
// The client context is resolved from the authenticated ClientUser.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentClientContext } from '@/lib/auth';
import {
  createInboundShipment,
  createInboundShipmentSchema,
  type CreateInboundShipmentInput,
} from '@/features/inbound';

type Result = { ok: true; data: { id: string } } | { ok: false; error: string };

export async function createInboundShipmentAction(
  input: CreateInboundShipmentInput,
): Promise<Result> {
  const parsed = createInboundShipmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { tenant, client } = await getCurrentClientContext();
  try {
    const shipment = await createInboundShipment(tenant, {
      ...parsed.data,
      clientId: client.id,
    });
    revalidatePath('/portal/inbound-shipments');
    return { ok: true, data: { id: shipment.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('No "Warehouse" record')) {
      return { ok: false, error: 'That warehouse is no longer available.' };
    }
    if (message.includes('do not belong to this client')) {
      return { ok: false, error: 'One or more SKUs do not belong to your account.' };
    }
    console.error('createInboundShipmentAction failed', err);
    return { ok: false, error: 'Failed to create inbound shipment. Please try again.' };
  }
}

export async function createAndRedirectToShipment(input: CreateInboundShipmentInput) {
  'use server';
  const result = await createInboundShipmentAction(input);
  if (result.ok) {
    redirect(`/portal/inbound-shipments/${result.data.id}`);
  }
  return result;
}
