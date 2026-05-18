import Link from 'next/link';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
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

export default async function PackQueuePage() {
  const { tenant } = await getCurrentStaffContext();
  const queue = await listPackQueue(tenant);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pack queue</h1>
        <p className="text-muted-foreground text-sm">
          Picked orders ready to box up. Click an order to enter dimensions and weight.
        </p>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders to pack"
          description="When a picker finishes an order, it shows up here."
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/warehouse/pack/${row.id}`}
                      className="underline-offset-4 hover:underline"
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
