import type { User } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { assertNotLastActiveAdmin } from './assert-not-last-active-admin';
import type { UpdateStaffStatusInput } from '../validation';

export class CannotChangeOwnStatusError extends Error {
  constructor() {
    super('You cannot change your own status.');
    this.name = 'CannotChangeOwnStatusError';
  }
}

export async function updateStaffStatus(
  ctx: TenantContext,
  args: UpdateStaffStatusInput & { actorUserId: string },
): Promise<User> {
  if (args.userId === args.actorUserId) {
    throw new CannotChangeOwnStatusError();
  }

  return withTenantContext(ctx, async (tx) => {
    await tx.user.findUniqueOrThrow({
      where: { id: args.userId },
      select: { id: true },
    });

    await assertNotLastActiveAdmin(tx, {
      companyId: ctx.companyId,
      targetUserId: args.userId,
      change: { status: args.status },
    });

    return tx.user.update({
      where: { id: args.userId },
      data: { status: args.status },
    });
  });
}
