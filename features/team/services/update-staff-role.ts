import type { User } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertNotLastActiveAdmin } from './assert-not-last-active-admin';
import type { UpdateStaffRoleInput } from '../validation';

// Caller-supplied actor id (typically from getCurrentStaffContext().user.id)
// drives self-protection.
export class CannotChangeOwnRoleError extends Error {
  constructor() {
    super('You cannot change your own role.');
    this.name = 'CannotChangeOwnRoleError';
  }
}

export async function updateStaffRole(
  ctx: TenantContext,
  args: UpdateStaffRoleInput & { actorUserId: string },
): Promise<User> {
  if (args.userId === args.actorUserId) {
    throw new CannotChangeOwnRoleError();
  }

  return withTenantContext(ctx, async (tx) => {
    // RLS-load to confirm the target is visible in this tenant.
    await tx.user.findUniqueOrThrow({
      where: { id: args.userId },
      select: { id: true },
    });

    await assertNotLastActiveAdmin(tx, {
      companyId: ctx.companyId,
      targetUserId: args.userId,
      change: { role: args.role },
    });

    return tx.user.update({
      where: { id: args.userId },
      data: { role: args.role },
    });
  });
}
