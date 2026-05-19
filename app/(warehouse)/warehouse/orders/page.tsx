import Link from 'next/link';
import { ChevronRight, FileUp, Plus, ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
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
      <PageHeader
        title="Orders"
        description="Outbound orders across all clients. Click an order to see its status timeline, lines, and assignment."
        helpKey="warehouse.orders"
        action={
          <>
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
          </>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Orders placed by clients or created by staff will appear here. Create your first one to get started."
          action={
            <Button asChild>
              <Link href="/warehouse/orders/new">
                <Plus className="size-4" />
                New order
              </Link>
            </Button>
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
                <TableHead>Lines</TableHead>
                <TableHead>Total qty</TableHead>
                <TableHead>Ship to</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow
                  key={o.id}
                  className="hover:bg-accent/40 group relative cursor-pointer transition-colors"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/warehouse/orders/${o.id}`}
                      className="after:absolute after:inset-0 after:content-['']"
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
