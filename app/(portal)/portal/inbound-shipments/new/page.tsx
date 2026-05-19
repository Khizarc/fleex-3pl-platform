import { PageHeader } from '@/components/page-header';
import { getCurrentClientContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { CreateInboundForm } from './_components/create-inbound-form';

export default async function NewInboundShipmentPage() {
  const { tenant } = await getCurrentClientContext();

  // Fetch warehouses (parent 3PL's warehouses — RLS allows reads) and the
  // client's own SKUs (RLS restricts to own client in portal context).
  const [warehouses, skus] = await Promise.all([
    withTenantContext(tenant, async (tx) =>
      tx.warehouse.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ),
    withTenantContext(tenant, async (tx) =>
      tx.sKU.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notify of incoming shipment"
        description="Tell your 3PL what's on the way so they can prepare to receive it. Add lines for each SKU and quantity."
        backHref="/portal/inbound-shipments"
        backLabel="All inbound shipments"
      />

      <CreateInboundForm warehouses={warehouses} skus={skus} />
    </div>
  );
}
