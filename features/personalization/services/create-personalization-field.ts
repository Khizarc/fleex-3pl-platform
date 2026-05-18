import type { PersonalizationField } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { CreatePersonalizationFieldInput } from '../validation';

// Create a new personalization field for a client. RLS-loads the client to
// derive companyId (defense in depth + ensures the caller can actually see
// that client).
export async function createPersonalizationField(
  ctx: TenantContext,
  args: CreatePersonalizationFieldInput & { clientId: string },
): Promise<PersonalizationField> {
  return withTenantContext(ctx, async (tx) => {
    const client = await tx.client.findUniqueOrThrow({
      where: { id: args.clientId },
      select: { id: true, companyId: true },
    });

    return tx.personalizationField.create({
      data: {
        key: args.key,
        label: args.label,
        description: args.description,
        required: args.required ?? false,
        sortOrder: args.sortOrder ?? 0,
        clientId: client.id,
        companyId: client.companyId,
      },
    });
  });
}
