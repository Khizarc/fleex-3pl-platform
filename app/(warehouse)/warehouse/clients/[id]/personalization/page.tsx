import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { CreatePersonalizationFieldDialog } from '@/components/personalization/create-field-dialog';
import { PersonalizationFieldsTable } from '@/components/personalization/fields-table';
import { listPersonalizationFields } from '@/features/personalization';
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/warehouse/clients/${clientId}`}
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          Back to {client.name}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.name} — Personalization
            </h1>
            <p className="text-muted-foreground text-sm">
              Per-line custom fields for this client&apos;s orders.
            </p>
          </div>
          <CreatePersonalizationFieldDialog
            action={(input) => createPersonalizationFieldAction(clientId, input)}
          />
        </div>
      </div>

      {fields.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No personalization fields yet"
          description="Add fields like engraving text or monogram. They appear on every order line for this client."
        />
      ) : (
        <PersonalizationFieldsTable
          fields={fields}
          disableAction={(fieldId) => disablePersonalizationFieldAction(clientId, fieldId)}
          enableAction={(fieldId) => enablePersonalizationFieldAction(clientId, fieldId)}
        />
      )}
    </div>
  );
}
