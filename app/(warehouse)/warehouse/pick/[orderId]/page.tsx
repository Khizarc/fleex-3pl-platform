import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { OrderStatus } from '@prisma/client';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { getPickList } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';
import { PickRow } from './_components/pick-row';

export default async function PickOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { tenant } = await getCurrentStaffContext();
  const data = await getPickList(tenant, orderId).catch(() => null);
  if (!data) notFound();

  const { order, allocations } = data;
  const totalAllocations = allocations.length;
  const pickedAllocations = allocations.filter((a) => a.pickedAt !== null).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/warehouse/pick"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          Pick queue
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{order.reference}</h1>
            <p className="text-muted-foreground text-sm">
              <strong>{order.client.name}</strong> · Ship to {order.shipToCity},{' '}
              {order.shipToRegion} {order.shipToPostalCode}
              {order.customerNote ? ` · Note: ${order.customerNote}` : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {pickedAllocations} / {totalAllocations}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {order.status === OrderStatus.PICKED ? (
        <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm dark:border-green-700 dark:bg-green-950">
          All allocations picked — ready for pack.
        </div>
      ) : null}

      <div className="space-y-3">
        {allocations.map((alloc) => (
          <PickRow
            key={alloc.id}
            orderId={order.id}
            allocationId={alloc.id}
            binLabel={alloc.bin.label}
            zoneName={alloc.bin.aisle.zone.name}
            aisleName={alloc.bin.aisle.name}
            skuCode={alloc.line.sku.code}
            skuName={alloc.line.sku.name}
            quantity={alloc.quantityReserved}
            personalization={alloc.line.personalizations.map((p) => ({
              fieldKey: p.fieldKey,
              value: p.value,
            }))}
            pickedAt={alloc.pickedAt}
            pickedByName={alloc.pickedBy?.name ?? null}
          />
        ))}
      </div>
    </div>
  );
}
