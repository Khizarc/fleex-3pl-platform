'use server';

// Server actions for the warehouse-structure feature. Each one resolves the
// staff context, re-validates input with the same zod schema the client used
// (defense in depth), and calls the service. revalidatePath ensures the next
// navigation re-fetches the list.

import { revalidatePath } from 'next/cache';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  createAisle,
  createAisleSchema,
  createBin,
  createBinSchema,
  createWarehouse,
  createWarehouseSchema,
  createZone,
  createZoneSchema,
  type CreateAisleInput,
  type CreateBinInput,
  type CreateWarehouseInput,
  type CreateZoneInput,
} from '@/features/warehouses';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('Unique constraint')) {
    return 'A record with that name already exists in this location.';
  }
  if (message.includes('No "Warehouse" record')) return 'That warehouse no longer exists.';
  if (message.includes('No "Zone" record')) return 'That zone no longer exists.';
  if (message.includes('No "Aisle" record')) return 'That aisle no longer exists.';
  return 'Something went wrong. Please try again.';
}

export async function createWarehouseAction(
  input: CreateWarehouseInput,
): Promise<Result<{ id: string }>> {
  const parsed = createWarehouseSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { tenant } = await getCurrentStaffContext();
  try {
    const wh = await createWarehouse(tenant, parsed.data);
    revalidatePath('/warehouse/warehouses');
    return { ok: true, data: { id: wh.id } };
  } catch (err) {
    console.error('createWarehouseAction failed', err);
    return { ok: false, error: friendlyError(err) };
  }
}

export async function createZoneAction(input: CreateZoneInput): Promise<Result<{ id: string }>> {
  const parsed = createZoneSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { tenant } = await getCurrentStaffContext();
  try {
    const zone = await createZone(tenant, parsed.data);
    revalidatePath(`/warehouse/warehouses/${parsed.data.warehouseId}`);
    return { ok: true, data: { id: zone.id } };
  } catch (err) {
    console.error('createZoneAction failed', err);
    return { ok: false, error: friendlyError(err) };
  }
}

export async function createAisleAction(input: CreateAisleInput): Promise<Result<{ id: string }>> {
  const parsed = createAisleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { tenant } = await getCurrentStaffContext();
  try {
    const aisle = await createAisle(tenant, parsed.data);
    revalidatePath('/warehouse/warehouses', 'layout');
    return { ok: true, data: { id: aisle.id } };
  } catch (err) {
    console.error('createAisleAction failed', err);
    return { ok: false, error: friendlyError(err) };
  }
}

export async function createBinAction(input: CreateBinInput): Promise<Result<{ id: string }>> {
  const parsed = createBinSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { tenant } = await getCurrentStaffContext();
  try {
    const bin = await createBin(tenant, parsed.data);
    revalidatePath('/warehouse/warehouses', 'layout');
    return { ok: true, data: { id: bin.id } };
  } catch (err) {
    console.error('createBinAction failed', err);
    return { ok: false, error: friendlyError(err) };
  }
}
