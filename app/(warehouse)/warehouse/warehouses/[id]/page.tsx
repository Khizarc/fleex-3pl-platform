import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getWarehouse } from '@/features/warehouses';
import { getCurrentStaffContext } from '@/lib/auth';
import { CreateZoneDialog } from './_components/create-zone-dialog';
import { CreateAisleDialog } from './_components/create-aisle-dialog';
import { CreateBinDialog, type AisleOption } from './_components/create-bin-dialog';

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await getCurrentStaffContext();
  const warehouse = await getWarehouse(tenant, id);
  if (!warehouse) notFound();

  // Flatten the nested structure for the dialog dropdowns.
  const zoneOptions = warehouse.zones.map((z) => ({ id: z.id, name: z.name }));
  const aisleOptions: AisleOption[] = warehouse.zones.flatMap((z) =>
    z.aisles.map((a) => ({ id: a.id, name: a.name, zoneName: z.name })),
  );
  const allAisles = warehouse.zones.flatMap((z) =>
    z.aisles.map((a) => ({ ...a, zoneName: z.name })),
  );
  const allBins = warehouse.zones.flatMap((z) =>
    z.aisles.flatMap((a) => a.bins.map((b) => ({ ...b, aisleName: a.name, zoneName: z.name }))),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={warehouse.name}
        description={warehouse.address ?? 'Organize this warehouse into zones, aisles, and bins.'}
        backHref="/warehouse/warehouses"
        backLabel="All warehouses"
      />

      <Section
        title="Zones"
        description="Logical areas inside this warehouse."
        action={<CreateZoneDialog warehouseId={warehouse.id} />}
      >
        {warehouse.zones.length === 0 ? (
          <EmptyRow message="No zones yet. Add one to start subdividing the warehouse." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Aisles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouse.zones.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.name}</TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {z.aisles.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Aisles"
        description="Rows of bins inside zones."
        action={<CreateAisleDialog zones={zoneOptions} />}
      >
        {allAisles.length === 0 ? (
          <EmptyRow message="No aisles yet. Create a zone first, then add aisles to it." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Aisle</TableHead>
                <TableHead className="text-right">Bins</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAisles.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground">{a.zoneName}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {a.bins.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Bins"
        description="Individual storage slots. Inventory lands here starting in Phase 1.3."
        action={<CreateBinDialog aisles={aisleOptions} />}
      >
        {allBins.length === 0 ? (
          <EmptyRow message="No bins yet. Create an aisle first, then add bins to it." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allBins.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-muted-foreground">
                    {b.zoneName} · {b.aisleName}
                  </TableCell>
                  <TableCell className="font-medium">{b.label}</TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {b.status.toLowerCase()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action}
      </div>
      <div className="rounded-lg border">{children}</div>
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="text-muted-foreground p-6 text-center text-sm">{message}</p>;
}
