import Link from 'next/link';
import { Truck } from 'lucide-react';
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
import { InboundStatusBadge } from '@/components/inbound/status-badge';
import { listInboundShipments } from '@/features/inbound';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function StaffInboundShipmentsPage() {
  const { tenant } = await getCurrentStaffContext();
  const shipments = await listInboundShipments(tenant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbound shipments"
        description="Incoming inventory from clients. Click a shipment to start receiving it into bins."
        helpKey="warehouse.inbound"
      />

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No inbound shipments yet"
          description="Clients notify you of incoming inventory from their portal — shipments will appear here for receiving."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
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
                      href={`/warehouse/inbound-shipments/${s.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {s.reference ?? `Shipment ${s.id.slice(0, 8)}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.client.name}</TableCell>
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
