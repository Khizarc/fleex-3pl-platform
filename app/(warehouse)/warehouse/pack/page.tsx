import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { listPackQueue } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { Button } from '@/components/ui/button';

export default async function PackQueuePage() {
  const { tenant } = await getCurrentStaffContext();
  const [queue, picking] = await Promise.all([
    listPackQueue(tenant),
    withTenantContext(tenant, async (tx) => tx.order.count({ where: { status: 'PICKING' } })),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pack queue"
        description="Picked orders ready to box up. Click an order to enter box dimensions, weight, and any pack notes."
        helpKey="warehouse.pack"
      />

      {queue.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders to pack"
          description={
            picking > 0
              ? `${picking} order${picking === 1 ? ' is' : 's are'} currently being picked. They'll show up here when complete.`
              : 'When a picker finishes an order, it shows up here.'
          }
          action={
            picking > 0 ? (
              <Button asChild variant="outline">
                <Link href="/warehouse/pick">View pick queue</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Total qty</TableHead>
                <TableHead>Ship to</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-accent/40 group relative cursor-pointer transition-colors"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/warehouse/pack/${row.id}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {row.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.clientName}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.assigneeName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.lineCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.totalQuantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.shipToCity}, {row.shipToRegion}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {row.submittedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="w-8">
                    <ChevronRight className="text-muted-foreground size-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
