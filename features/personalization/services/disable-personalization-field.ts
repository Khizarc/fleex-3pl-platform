import { AccountStatus, type PersonalizationField } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Soft-delete: flip status to DISABLED so historical OrderLinePersonalization
// rows continue to reference a real PersonalizationField row (FK is
// onDelete: Restrict). The order-create path filters on ACTIVE only, so new
// orders cannot capture values for a disabled field.
export async function disablePersonalizationField(
  ctx: TenantContext,
  fieldId: string,
): Promise<PersonalizationField> {
  return withTenantContext(ctx, async (tx) => {
    await tx.personalizationField.findUniqueOrThrow({
      where: { id: fieldId },
      select: { id: true },
    });
    return tx.personalizationField.update({
      where: { id: fieldId },
      data: { status: AccountStatus.DISABLED },
    });
  });
}

// Re-enable a previously disabled field. Same identity (key) is preserved.
export async function enablePersonalizationField(
  ctx: TenantContext,
  fieldId: string,
): Promise<PersonalizationField> {
  return withTenantContext(ctx, async (tx) => {
    await tx.personalizationField.findUniqueOrThrow({
      where: { id: fieldId },
      select: { id: true },
    });
    return tx.personalizationField.update({
      where: { id: fieldId },
      data: { status: AccountStatus.ACTIVE },
    });
  });
}
