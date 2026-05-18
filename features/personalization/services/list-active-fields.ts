import { AccountStatus, type PersonalizationField } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// ACTIVE-only fields. Used by order create (manual + CSV) to validate
// incoming personalization keys against the client's current schema.
// Optional `clientId` arg lets staff scope to a specific client when
// they're calling on behalf.
export async function listActivePersonalizationFields(
  ctx: TenantContext,
  options: { clientId?: string } = {},
): Promise<PersonalizationField[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.personalizationField.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        ...(options.clientId ? { clientId: options.clientId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
  });
}
