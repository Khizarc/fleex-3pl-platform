import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personalization</h1>
          <p className="text-muted-foreground text-sm">
            {client.name}&apos;s per-line custom fields. Captured on each order line and visible at
            pack time.
          </p>
        </div>
        <CreatePersonalizationFieldDialog action={createPersonalizationFieldAction} />
      </div>

      {fields.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No personalization fields yet"
          description="Define fields like engraving text, monogram, or gift note. Values appear on every order line."
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
