import type { PersonalizationField } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Returns ALL fields (any status) visible to the caller. Used by the admin
// UI. For order-creation paths, prefer `listActivePersonalizationFields`.
// Sorted deterministically by (sortOrder, key) so UX doesn't shift as fields
// are added.
export async function listPersonalizationFields(
  ctx: TenantContext,
  options: { clientId?: string } = {},
): Promise<PersonalizationField[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.personalizationField.findMany({
      where: options.clientId ? { clientId: options.clientId } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
  });
}
