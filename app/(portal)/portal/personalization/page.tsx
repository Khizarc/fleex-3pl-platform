import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { CreatePersonalizationFieldDialog } from '@/components/personalization/create-field-dialog';
import { PersonalizationFieldsTable } from '@/components/personalization/fields-table';
import { listPersonalizationFields } from '@/features/personalization';
import { getCurrentClientContext } from '@/lib/auth';
import {
  createPersonalizationFieldAction,
  disablePersonalizationFieldAction,
  enablePersonalizationFieldAction,
} from './actions';

export default async function PortalPersonalizationPage() {
  const { tenant, client } = await getCurrentClientContext();
  const fields = await listPersonalizationFields(tenant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personalization"
        description={`${client.name}'s per-line custom fields. Captured on each order line and visible to staff at pack time.`}
        action={<CreatePersonalizationFieldDialog action={createPersonalizationFieldAction} />}
      />

      {fields.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No personalization fields yet"
          description="Define fields like engraving text, monogram, or gift note. Values appear on every order line."
          action={<CreatePersonalizationFieldDialog action={createPersonalizationFieldAction} />}
        />
      ) : (
        <PersonalizationFieldsTable
          fields={fields}
          disableAction={disablePersonalizationFieldAction}
          enableAction={enablePersonalizationFieldAction}
        />
      )}
    </div>
  );
}
