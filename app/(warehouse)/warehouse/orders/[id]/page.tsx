import { notFound } from 'next/navigation';
import { AccountStatus, OrderStatus, Role } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderActivityFeed } from '@/components/orders/order-activity-feed';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { OrderStatusTimeline } from '@/components/orders/order-status-timeline';
import { OrderSummaryCard } from '@/components/orders/order-summary-card';
import { PageHeader } from '@/components/page-header';
import { getOrder, getOrderActivity } from '@/features/orders';
import { listStaff } from '@/features/team';
import { getCurrentStaffContext } from '@/lib/auth';
import { carrierDisplayName, carrierTrackingUrl } from '@/lib/carriers';
import { AssigneePicker } from './_components/assignee-picker';
import { OrderActions } from './_components/order-actions';

export default async function WarehouseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant, user } = await getCurrentStaffContext();
  const order = await getOrder(tenant, id).catch(() => null);
  if (!order) notFound();

  const [activity] = await Promise.all([getOrderActivity(tenant, id)]);

  const canAllocate =
    order.status === OrderStatus.SUBMITTED || order.status === OrderStatus.AWAITING_STOCK;
  const canCancel =
    order.status === OrderStatus.SUBMITTED ||
    order.status === OrderStatus.AWAITING_STOCK ||
    order.status === OrderStatus.READY_TO_PICK;

  const TERMINAL_ASSIGN_STATUSES: OrderStatus[] = [
    OrderStatus.SHIPPED,
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ];
  const canAssign = user.role === Role.ADMIN && !TERMINAL_ASSIGN_STATUSES.includes(order.status);
  const activeStaff = canAssign
    ? (await listStaff(tenant)).filter((s) => s.status === AccountStatus.ACTIVE)
    : [];
  const assigneeStatusNotActive =
    order.assignedToUser && order.assignedToUser.status !== AccountStatus.ACTIVE;

  const totalQty = order.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.reference}
        description={`Client: ${order.client.name} · Submitted ${order.submittedAt.toLocaleDateString()}`}
        backHref="/warehouse/orders"
        backLabel="All orders"
        action={
          <>
            <OrderStatusBadge status={order.status} />
            <OrderActions orderId={order.id} canAllocate={canAllocate} canCancel={canCancel} />
          </>
        }
        helpKey="warehouse.order-detail"
      />

      <OrderStatusTimeline status={order.status} cancelledAt={order.cancelledAt} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
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
                          l.allocations
                            .map((a) => `${a.bin.label}: ${a.quantityReserved}`)
                            .join(' · ')
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Activity</h2>
            <OrderActivityFeed events={activity} />
          </section>
        </div>

        <aside className="space-y-4">
          <OrderSummaryCard
            rows={[
              { label: 'Client', value: order.client.name },
              { label: 'Lines', value: order.lines.length },
              { label: 'Total qty', value: totalQty },
              {
                label: 'Assignee',
                value: order.assignedToUser ? (
                  <span>
                    {order.assignedToUser.name}{' '}
                    <span className="text-muted-foreground text-xs">
                      · {order.assignedToUser.role}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                ),
              },
              {
                label: 'Ship to',
                value: (
                  <span className="text-xs">
                    {order.shipToCity}, {order.shipToRegion}
                  </span>
                ),
              },
              ...(order.carrier && order.trackingNumber
                ? [
                    {
                      label: 'Carrier',
                      value: (
                        <span className="text-xs">
                          {carrierDisplayName(order.carrier, order.carrierOther)}
                        </span>
                      ),
                    },
                    {
                      label: 'Tracking',
                      value: carrierTrackingUrl[order.carrier] ? (
                        <a
                          href={carrierTrackingUrl[order.carrier]!(order.trackingNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs underline-offset-4 hover:underline"
                        >
                          {order.trackingNumber}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{order.trackingNumber}</span>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Ship to
            </h3>
            <div className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-xs">
              <div className="text-foreground font-medium">{order.shipToName}</div>
              <div>{order.shipToLine1}</div>
              {order.shipToLine2 ? <div>{order.shipToLine2}</div> : null}
              <div>
                {order.shipToCity}, {order.shipToRegion} {order.shipToPostalCode}
              </div>
              <div>{order.shipToCountry}</div>
            </div>
            {order.customerNote ? (
              <p className="text-muted-foreground bg-muted/30 rounded-md border p-3 text-xs">
                <span className="font-medium">Note:</span> {order.customerNote}
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Assignment
            </h3>
            {canAssign ? (
              <AssigneePicker
                orderId={order.id}
                currentAssigneeId={order.assignedToUser?.id ?? null}
                options={activeStaff.map((s) => ({ id: s.id, name: s.name, role: s.role }))}
              />
            ) : null}
            {assigneeStatusNotActive ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-700 dark:bg-amber-950">
                Assignee&apos;s account is {order.assignedToUser!.status}. Reassign to keep work
                moving.
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
