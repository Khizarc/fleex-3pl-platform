import { notFound } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { CreatePersonalizationFieldDialog } from '@/components/personalization/create-field-dialog';
import { PersonalizationFieldsTable } from '@/components/personalization/fields-table';
import {
  listPersonalizationFields,
  type CreatePersonalizationFieldInput,
} from '@/features/personalization';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import {
  createPersonalizationFieldAction,
  disablePersonalizationFieldAction,
  enablePersonalizationFieldAction,
} from './actions';

export default async function StaffClientPersonalizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const { tenant } = await getCurrentStaffContext();

  const client = await withTenantContext(tenant, async (tx) =>
    tx.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }),
  );
  if (!client) notFound();

  const fields = await listPersonalizationFields(tenant, { clientId });

  // Bind clientId into the action props via inline `'use server'` functions
  // so the closures are themselves server actions (serializable across the
  // server→client boundary). Same pattern as
  // /warehouse/clients/[id]/page.tsx's product action.
  async function createAction(input: CreatePersonalizationFieldInput) {
    'use server';
    return createPersonalizationFieldAction(clientId, input);
  }
  async function disableAction(fieldId: string) {
    'use server';
    return disablePersonalizationFieldAction(clientId, fieldId);
  }
  async function enableAction(fieldId: string) {
    'use server';
    return enablePersonalizationFieldAction(clientId, fieldId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${client.name} — Personalization`}
        description="Per-line custom fields for this client's orders, like engraving text or monograms. Fields appear on every order line submission."
        backHref={`/warehouse/clients/${clientId}`}
        backLabel={`Back to ${client.name}`}
        action={<CreatePersonalizationFieldDialog action={createAction} />}
        helpKey="warehouse.personalization"
      />

      {fields.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No personalization fields yet"
          description="Add fields like engraving text or monogram. They appear on every order line for this client."
          action={<CreatePersonalizationFieldDialog action={createAction} />}
        />
      ) : (
        <PersonalizationFieldsTable
          fields={fields}
          disableAction={disableAction}
          enableAction={enableAction}
        />
      )}
    </div>
  );
}
