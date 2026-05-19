import Link from 'next/link';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { listPickQueue } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { Button } from '@/components/ui/button';

export default async function PickQueuePage() {
  const { tenant } = await getCurrentStaffContext();
  const [queue, upstreamCount] = await Promise.all([
    listPickQueue(tenant),
    withTenantContext(tenant, async (tx) =>
      tx.order.count({ where: { status: { in: ['SUBMITTED', 'AWAITING_STOCK'] } } }),
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pick queue"
        description="Orders awaiting pick or in progress, oldest first. Click an order to walk its bins and scan-confirm each allocation."
        helpKey="warehouse.pick"
      />

      {queue.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No orders waiting"
          description={
            upstreamCount > 0
              ? `Nothing ready to pick yet — but ${upstreamCount} order${upstreamCount === 1 ? ' is' : 's are'} waiting on allocation. They'll show up here once stock is reserved.`
              : 'When a client places an order and it allocates, it shows up here.'
          }
          action={
            upstreamCount > 0 ? (
              <Button asChild>
                <Link href="/warehouse/orders">View pending orders</Link>
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
                <TableHead>Progress</TableHead>
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
                      href={`/warehouse/pick/${row.id}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {row.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.clientName}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {row.pickedAllocations} / {row.totalAllocations}
                    </Badge>
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
