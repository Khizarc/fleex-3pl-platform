import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
      <div className="space-y-2">
        <Link
          href="/portal/inbound-shipments"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All inbound shipments
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notify of incoming shipment</h1>
          <p className="text-muted-foreground text-sm">
            Tell your 3PL what&apos;s on the way so they can prepare to receive it.
          </p>
        </div>
      </div>

      <CreateInboundForm warehouses={warehouses} skus={skus} />
    </div>
  );
}
