import type { PersonalizationField } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { UpdatePersonalizationFieldInput } from '../validation';

// Update label / description / required / sortOrder. `key` is NOT editable
// — see the field-level note. `status` is changed via the dedicated
// disable / enable services.
export async function updatePersonalizationField(
  ctx: TenantContext,
  fieldId: string,
  args: UpdatePersonalizationFieldInput,
): Promise<PersonalizationField> {
  return withTenantContext(ctx, async (tx) => {
    // RLS-load to confirm the caller can see it. The update() below uses an
    // id-only where, so an explicit existence check on a tenant-scoped query
    // is what keeps the operation honest.
    await tx.personalizationField.findUniqueOrThrow({
      where: { id: fieldId },
      select: { id: true },
    });

    return tx.personalizationField.update({
      where: { id: fieldId },
      data: {
        ...(args.label !== undefined ? { label: args.label } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.required !== undefined ? { required: args.required } : {}),
        ...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
      },
    });
  });
}
