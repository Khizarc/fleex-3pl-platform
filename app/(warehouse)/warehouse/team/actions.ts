'use server';

// Team management server actions (Milestone 1.11). ADMIN-only.

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { getCurrentStaffContext } from '@/lib/auth';
import {
  CannotChangeOwnRoleError,
  CannotChangeOwnStatusError,
  LastActiveAdminError,
  StaffEmailAlreadyExistsError,
  inviteStaff,
  inviteStaffInputSchema,
  updateStaffRole,
  updateStaffRoleInputSchema,
  updateStaffStatus,
  updateStaffStatusInputSchema,
  type InviteStaffInput,
  type UpdateStaffRoleInput,
  type UpdateStaffStatusInput,
} from '@/features/team';

type CreateResult = { ok: true; data: { id: string } } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const ctx = await getCurrentStaffContext();
  if (ctx.user.role !== Role.ADMIN) {
    return { error: 'Only ADMIN users can manage the team.' as const, ctx: null };
  }
  return { error: null, ctx };
}

export async function inviteStaffAction(input: InviteStaffInput): Promise<CreateResult> {
  const parsed = inviteStaffInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { error, ctx } = await requireAdmin();
  if (error) return { ok: false, error };

  try {
    const user = await inviteStaff(ctx.tenant, parsed.data);
    revalidatePath('/warehouse/team');
    return { ok: true, data: { id: user.id } };
  } catch (err) {
    if (err instanceof StaffEmailAlreadyExistsError) {
      return { ok: false, error: err.message };
    }
    console.error('inviteStaffAction failed', err);
    return { ok: false, error: 'Failed to invite staff member.' };
  }
}

export async function updateStaffRoleAction(input: UpdateStaffRoleInput): Promise<SimpleResult> {
  const parsed = updateStaffRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { error, ctx } = await requireAdmin();
  if (error) return { ok: false, error };

  try {
    await updateStaffRole(ctx.tenant, { ...parsed.data, actorUserId: ctx.user.id });
    revalidatePath('/warehouse/team');
    return { ok: true };
  } catch (err) {
    if (err instanceof CannotChangeOwnRoleError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof LastActiveAdminError) {
      return { ok: false, error: err.message };
    }
    console.error('updateStaffRoleAction failed', err);
    return { ok: false, error: 'Failed to update role.' };
  }
}

export async function updateStaffStatusAction(
  input: UpdateStaffStatusInput,
): Promise<SimpleResult> {
  const parsed = updateStaffStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { error, ctx } = await requireAdmin();
  if (error) return { ok: false, error };

  try {
    await updateStaffStatus(ctx.tenant, { ...parsed.data, actorUserId: ctx.user.id });
    revalidatePath('/warehouse/team');
    return { ok: true };
  } catch (err) {
    if (err instanceof CannotChangeOwnStatusError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof LastActiveAdminError) {
      return { ok: false, error: err.message };
    }
    console.error('updateStaffStatusAction failed', err);
    return { ok: false, error: 'Failed to update status.' };
  }
}
