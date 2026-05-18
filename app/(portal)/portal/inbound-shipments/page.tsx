import Link from 'next/link';
import { Plus, Truck } from 'lucide-react';
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
import { InboundStatusBadge } from '@/components/inbound/status-badge';
import { listInboundShipments } from '@/features/inbound';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalInboundShipmentsPage() {
  const { tenant } = await getCurrentClientContext();
  const shipments = await listInboundShipments(tenant);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbound shipments</h1>
          <p className="text-muted-foreground text-sm">
            Notify your 3PL when inventory is on its way.
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/inbound-shipments/new">
            <Plus className="size-4" />
            Notify of incoming
          </Link>
        </Button>
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No inbound shipments yet"
          description="Click 'Notify of incoming' to tell your 3PL what's on the way."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/portal/inbound-shipments/${s.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {s.reference ?? `Shipment ${s.id.slice(0, 8)}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.warehouse.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s._count.lines}</TableCell>
                  <TableCell>
                    <InboundStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {s.createdAt.toLocaleDateString()}
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
