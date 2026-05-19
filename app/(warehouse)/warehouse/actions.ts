'use server';

import { revalidatePath } from 'next/cache';
import { DemoDataAlreadyExistsError, resetDemoData, seedDemoData } from '@/features/onboarding';
import { getCurrentStaffContext } from '@/lib/auth';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function loadDemoDataAction(): Promise<ActionResult> {
  try {
    const { tenant, user } = await getCurrentStaffContext();
    await seedDemoData(tenant, { receivedByUserId: user.id });
    revalidatePath('/warehouse');
    return { ok: true };
  } catch (err) {
    if (err instanceof DemoDataAlreadyExistsError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load demo data.' };
  }
}

export async function resetDemoDataAction(): Promise<ActionResult> {
  try {
    const { tenant } = await getCurrentStaffContext();
    await resetDemoData(tenant);
    revalidatePath('/warehouse');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to reset demo data.' };
  }
}
