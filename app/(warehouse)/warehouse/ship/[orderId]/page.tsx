import { notFound } from 'next/navigation';
import { OrderStatus } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { PageHeader } from '@/components/page-header';
import { getOrder, mmToInches, gramsToOunces } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';
import { ShipForm } from './_components/ship-form';

export default async function ShipOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { tenant } = await getCurrentStaffContext();
  const order = await getOrder(tenant, orderId).catch(() => null);
  if (!order) notFound();

  const shippable = order.status === OrderStatus.PACKED;

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.reference}
        description={`${order.client.name} · Ship to ${order.shipToName}, ${order.shipToCity} ${order.shipToRegion}${
          order.customerNote ? ` · Note: ${order.customerNote}` : ''
        }`}
        backHref="/warehouse/ship"
        backLabel="Ship queue"
        action={<OrderStatusBadge status={order.status} />}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Box + contents</h2>
        {order.boxLengthMm && order.boxWidthMm && order.boxHeightMm && order.boxWeightG ? (
          <div className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
            Box: {mmToInches(order.boxLengthMm).toFixed(1)} ×{' '}
            {mmToInches(order.boxWidthMm).toFixed(1)} × {mmToInches(order.boxHeightMm).toFixed(1)}{' '}
            in · {gramsToOunces(order.boxWeightG).toFixed(1)} oz
            {order.packNotes ? ` · Pack note: ${order.packNotes}` : null}
          </div>
        ) : null}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name + personalization</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="align-top font-mono text-sm">{l.sku.code}</TableCell>
                  <TableCell className="text-muted-foreground align-top text-sm">
                    <div className="text-foreground">{l.sku.name}</div>
                    {l.personalizations.length > 0 ? (
                      <dl className="text-muted-foreground mt-1 grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 text-xs">
                        {l.personalizations.map((p) => (
                          <div key={p.id} className="contents">
                            <dt className="font-mono">{p.fieldKey}</dt>
                            <dd className="text-foreground">{p.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right align-top">{l.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {shippable ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Carrier + tracking</h2>
          <ShipForm orderId={order.id} />
        </section>
      ) : (
        <div className="bg-muted/30 text-muted-foreground rounded-md border p-4 text-sm">
          This order is not in PACKED status — ship is unavailable.
        </div>
      )}
    </div>
  );
}
