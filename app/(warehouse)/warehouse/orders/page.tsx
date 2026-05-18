import Link from 'next/link';
import { FileUp, Plus, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { listOrders } from '@/features/orders';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function WarehouseOrdersPage() {
  const { tenant } = await getCurrentStaffContext();
  const orders = await listOrders(tenant);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm">
            Outbound orders across all clients in this company.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/warehouse/orders/import">
              <FileUp className="size-4" />
              Import CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/warehouse/orders/new">
              <Plus className="size-4" />
              New order
            </Link>
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Orders placed by clients or created by staff will appear here."
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
                <TableHead className="text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/warehouse/orders/${o.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {o.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{o.clientName}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{o.lineCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{o.totalQuantity}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {o.shipToCity}, {o.shipToRegion}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {o.submittedAt.toLocaleDateString()}
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
