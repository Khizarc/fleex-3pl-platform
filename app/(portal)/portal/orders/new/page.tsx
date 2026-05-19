import { PageHeader } from '@/components/page-header';
import { getCurrentClientContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { listActivePersonalizationFields } from '@/features/personalization';
import { CreateOrderForm } from './_components/create-order-form';

export default async function NewOrderPage() {
  const { tenant } = await getCurrentClientContext();

  // RLS scopes to the caller's own client — only their SKUs + own definitions.
  const [skus, fields] = await Promise.all([
    withTenantContext(tenant, async (tx) =>
      tx.sKU.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ),
    listActivePersonalizationFields(tenant),
  ]);

  const definitions = fields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    required: f.required,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New order"
        description="Tell your 3PL where to ship, what to ship, and how much. Personalization fields appear automatically on each line."
        backHref="/portal/orders"
        backLabel="All orders"
      />

      <CreateOrderForm skus={skus} definitions={definitions} />
    </div>
  );
}
