import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
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
import { getOrder } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';
import { PackForm } from './_components/pack-form';

export default async function PackOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { tenant } = await getCurrentStaffContext();
  const order = await getOrder(tenant, orderId).catch(() => null);
  if (!order) notFound();

  const packable = order.status === OrderStatus.PICKED;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/warehouse/pack"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          Pack queue
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{order.reference}</h1>
            <p className="text-muted-foreground text-sm">
              <strong>{order.client.name}</strong> · Ship to {order.shipToName}, {order.shipToCity}{' '}
              {order.shipToRegion}
              {order.customerNote ? ` · Note: ${order.customerNote}` : null}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Items to pack</h2>
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

      {packable ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Box + weight</h2>
          <PackForm orderId={order.id} />
        </section>
      ) : (
        <div className="bg-muted/30 text-muted-foreground rounded-md border p-4 text-sm">
          This order is not in PICKED status — pack is unavailable.
        </div>
      )}
    </div>
  );
}
