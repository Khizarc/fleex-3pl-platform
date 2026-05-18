import Link from 'next/link';
import { Send } from 'lucide-react';
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
import { listShipQueue } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function ShipQueuePage() {
  const { tenant } = await getCurrentStaffContext();
  const queue = await listShipQueue(tenant);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ship queue</h1>
        <p className="text-muted-foreground text-sm">
          Packed orders ready to hand off to the carrier. Click an order to enter the carrier and
          tracking number.
        </p>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No orders to ship"
          description="When a packer finishes an order, it shows up here."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Total qty</TableHead>
                <TableHead>Ship to</TableHead>
                <TableHead className="text-right">Packed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/warehouse/ship/${row.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.clientName}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.lineCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.totalQuantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.shipToCity}, {row.shipToRegion}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {row.packedAt ? row.packedAt.toLocaleDateString() : '—'}
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
