// Invite an additional portal user to an existing Client. Mirrors the
// `firstUser` path in createClient — same row shape, same claim-by-email
// pattern (authProviderId stays NULL until the invitee signs up).

import type { ClientUser, Prisma } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export class ClientUserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`A portal user with email "${email}" already exists for this client.`);
    this.name = 'ClientUserAlreadyExistsError';
  }
}

export async function inviteClientUser(
  ctx: TenantContext,
  args: { clientId: string; email: string; name: string },
): Promise<ClientUser> {
  return withTenantContext(ctx, async (tx) => {
    // RLS-verify the client belongs to this tenant.
    const client = await tx.client.findUniqueOrThrow({
      where: { id: args.clientId },
      select: { id: true, companyId: true },
    });

    try {
      return await tx.clientUser.create({
        data: {
          authProviderId: null,
          email: args.email.trim().toLowerCase(),
          name: args.name.trim(),
          clientId: client.id,
          companyId: client.companyId,
        },
      });
    } catch (err) {
      // P2002 = unique constraint violation. Mostly hits when the same email
      // is re-invited; surface as a typed domain error.
      const e = err as Prisma.PrismaClientKnownRequestError;
      if (e?.code === 'P2002') throw new ClientUserAlreadyExistsError(args.email);
      throw err;
    }
  });
}
