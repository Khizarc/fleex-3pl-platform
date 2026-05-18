import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InboundStatusBadge } from '@/components/inbound/status-badge';
import { getInboundShipment } from '@/features/inbound';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalInboundShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await getCurrentClientContext();
  const shipment = await getInboundShipment(tenant, id);
  if (!shipment) notFound();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/portal/inbound-shipments"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All inbound shipments
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {shipment.reference ?? `Shipment ${shipment.id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              Destination: <strong>{shipment.warehouse.name}</strong>
              {shipment.expectedArrivalAt
                ? ` · expected ${shipment.expectedArrivalAt.toLocaleDateString()}`
                : null}
            </p>
          </div>
          <InboundStatusBadge status={shipment.status} />
        </div>
        {shipment.notes ? (
          <p className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
            {shipment.notes}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lines</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Received by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-sm">{l.sku.code}</TableCell>
                  <TableCell className="text-right">{l.expectedQuantity}</TableCell>
                  <TableCell className="text-right">
                    {l.actualQuantity ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {l.bin?.label ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {l.receivedBy?.name ?? '—'}
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
