import { Prisma, type User } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { InviteStaffInput } from '../validation';

// ADMIN invites a new staff member. Creates a User row with
// authProviderId=NULL. When the invitee signs in via Clerk, the auth
// resolver (lib/auth/current-user.ts) claims this row by email.
//
// `(companyId, email)` is unique at the DB; a duplicate invite within the
// same company surfaces as P2002 and gets translated into a typed error.

export class StaffEmailAlreadyExistsError extends Error {
  readonly email: string;
  constructor(email: string) {
    super(`A staff member with email "${email}" already exists in this company.`);
    this.name = 'StaffEmailAlreadyExistsError';
    this.email = email;
  }
}

export async function inviteStaff(ctx: TenantContext, args: InviteStaffInput): Promise<User> {
  return withTenantContext(ctx, async (tx) => {
    try {
      return await tx.user.create({
        data: {
          email: args.email,
          name: args.name,
          role: args.role,
          companyId: ctx.companyId,
          // authProviderId is null until Clerk sign-in claims it
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new StaffEmailAlreadyExistsError(args.email);
      }
      throw err;
    }
  });
}
