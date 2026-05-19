import { notFound } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InboundStatusBadge } from '@/components/inbound/status-badge';
import { PageHeader } from '@/components/page-header';
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
      <PageHeader
        title={shipment.reference ?? `Shipment ${shipment.id.slice(0, 8)}`}
        description={`Destination: ${shipment.warehouse.name}${
          shipment.expectedArrivalAt
            ? ` · expected ${shipment.expectedArrivalAt.toLocaleDateString()}`
            : ''
        }`}
        backHref="/portal/inbound-shipments"
        backLabel="All inbound shipments"
        action={<InboundStatusBadge status={shipment.status} />}
      />
      {shipment.notes ? (
        <p className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
          {shipment.notes}
        </p>
      ) : null}

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
