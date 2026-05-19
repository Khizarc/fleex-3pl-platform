import { notFound } from 'next/navigation';
import { InboundShipmentStatus } from '@prisma/client';
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
import { getInboundShipment } from '@/features/inbound';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { StartReceivingButton } from './_components/start-receiving-button';
import { CompleteButton } from './_components/complete-button';
import { ReceiveLineRow, type BinOption } from './_components/receive-line-row';

export default async function StaffInboundShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await getCurrentStaffContext();
  const shipment = await getInboundShipment(tenant, id);
  if (!shipment) notFound();

  // Bin options scoped to the shipment's destination warehouse — staff
  // shouldn't be able to receive stock into a bin elsewhere.
  const binsRaw = await withTenantContext(tenant, async (tx) =>
    tx.bin.findMany({
      where: { aisle: { zone: { warehouseId: shipment.warehouseId } } },
      include: {
        aisle: {
          select: { name: true, zone: { select: { name: true } } },
        },
      },
      orderBy: [{ label: 'asc' }],
    }),
  );
  const bins: BinOption[] = binsRaw.map((b) => ({
    id: b.id,
    label: b.label,
    aisleName: b.aisle.name,
    zoneName: b.aisle.zone.name,
  }));

  const canStart = shipment.status === InboundShipmentStatus.NOTIFIED;
  const canReceive = shipment.status === InboundShipmentStatus.RECEIVING;
  const canComplete = canReceive && shipment.lines.every((l) => l.receivedAt !== null);

  return (
    <div className="space-y-8">
      <PageHeader
        title={shipment.reference ?? `Shipment ${shipment.id.slice(0, 8)}`}
        description={`${shipment.client.name} → ${shipment.warehouse.name}${
          shipment.expectedArrivalAt
            ? ` · expected ${shipment.expectedArrivalAt.toLocaleDateString()}`
            : ''
        }`}
        backHref="/warehouse/inbound-shipments"
        backLabel="All inbound shipments"
        action={<InboundStatusBadge status={shipment.status} />}
      />
      {shipment.notes ? (
        <p className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-sm">
          {shipment.notes}
        </p>
      ) : null}

      <div className="flex gap-2">
        {canStart ? <StartReceivingButton shipmentId={shipment.id} /> : null}
        {canComplete ? <CompleteButton shipmentId={shipment.id} /> : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lines</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.lines.map((line) =>
                line.receivedAt ? (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-sm">{line.sku.code}</TableCell>
                    <TableCell className="text-right">{line.expectedQuantity}</TableCell>
                    <TableCell>{line.actualQuantity}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {line.bin?.label ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {line.notes ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">
                      received by {line.receivedBy?.name ?? '?'}
                    </TableCell>
                  </TableRow>
                ) : (
                  <ReceiveLineRow
                    key={line.id}
                    lineId={line.id}
                    skuCode={line.sku.code}
                    expectedQuantity={line.expectedQuantity}
                    bins={bins}
                    disabled={!canReceive}
                  />
                ),
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
