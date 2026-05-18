import { AccountStatus, type Prisma, Role } from '@prisma/client';

// Shared invariant: a company must always have at least one ACTIVE ADMIN.
// Called by update-staff-role (demotion) and update-staff-status (status
// flip away from ACTIVE). Both call paths potentially leave zero active
// ADMINs — this helper rejects that.
//
// `tx` is the Prisma transaction client from inside the caller's
// `withTenantContext`. Uses owner-role queries (no RLS) intentionally —
// the company-scope filter is on `companyId` explicitly.

export class LastActiveAdminError extends Error {
  constructor(companyId: string) {
    super(
      `Cannot demote or disable the last active ADMIN of company ${companyId}. ` +
        'Promote another staff member to ADMIN first.',
    );
    this.name = 'LastActiveAdminError';
  }
}

// `targetUserId` is the user about to change. `change` describes the
// hypothetical post-change state: would they remain ADMIN+ACTIVE?
export async function assertNotLastActiveAdmin(
  tx: Prisma.TransactionClient,
  args: {
    companyId: string;
    targetUserId: string;
    change: { role?: Role; status?: AccountStatus };
  },
): Promise<void> {
  const target = await tx.user.findUniqueOrThrow({
    where: { id: args.targetUserId },
    select: { role: true, status: true, companyId: true },
  });

  // Was the target an active ADMIN before the change?
  const wasActiveAdmin = target.role === Role.ADMIN && target.status === AccountStatus.ACTIVE;
  if (!wasActiveAdmin) return; // changes to non-admins or non-active never reduce admin count

  // Will the target still be an active ADMIN after the change?
  const newRole = args.change.role ?? target.role;
  const newStatus = args.change.status ?? target.status;
  const stillActiveAdmin = newRole === Role.ADMIN && newStatus === AccountStatus.ACTIVE;
  if (stillActiveAdmin) return; // no reduction

  // The change would remove this user from the active-ADMIN set. Verify at
  // least one OTHER active ADMIN remains.
  const otherActiveAdmins = await tx.user.count({
    where: {
      companyId: args.companyId,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      id: { not: args.targetUserId },
    },
  });
  if (otherActiveAdmins === 0) {
    throw new LastActiveAdminError(args.companyId);
  }
}
