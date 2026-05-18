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
import { getCurrentClientContext } from '@/lib/auth';
import { CancelOrderButton } from './_components/cancel-order-button';

export default async function PortalOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await getCurrentClientContext();
  const order = await getOrder(tenant, id).catch(() => null);
  if (!order) notFound();

  const canCancel =
    order.status === OrderStatus.SUBMITTED ||
    order.status === OrderStatus.AWAITING_STOCK ||
    order.status === OrderStatus.READY_TO_PICK;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/portal/orders"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All orders
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{order.reference}</h1>
            <p className="text-muted-foreground text-sm">
              Submitted {order.submittedAt.toLocaleDateString()}
              {order.allocatedAt ? ` · allocated ${order.allocatedAt.toLocaleDateString()}` : null}
              {order.cancelledAt ? ` · cancelled ${order.cancelledAt.toLocaleDateString()}` : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {canCancel ? <CancelOrderButton orderId={order.id} /> : null}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ship to</h2>
        <div className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
          <div className="text-foreground font-medium">{order.shipToName}</div>
          <div>{order.shipToLine1}</div>
          {order.shipToLine2 ? <div>{order.shipToLine2}</div> : null}
          <div>
            {order.shipToCity}, {order.shipToRegion} {order.shipToPostalCode}
          </div>
          <div>{order.shipToCountry}</div>
        </div>
        {order.customerNote ? (
          <p className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
            {order.customerNote}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lines</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead>Reserved from</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="align-top font-mono text-sm">{l.sku.code}</TableCell>
                  <TableCell className="text-muted-foreground align-top text-sm">
                    <div>{l.sku.name}</div>
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
                  <TableCell className="text-muted-foreground align-top text-sm">
                    {l.allocations.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      l.allocations.map((a) => `${a.bin.label}: ${a.quantityReserved}`).join(' · ')
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
