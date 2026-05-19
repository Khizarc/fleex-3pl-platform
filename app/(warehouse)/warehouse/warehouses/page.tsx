import Link from 'next/link';
import { Warehouse as WarehouseIcon } from 'lucide-react';
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
import { listWarehouses } from '@/features/warehouses';
import { getCurrentStaffContext } from '@/lib/auth';
import { CreateWarehouseDialog } from './_components/create-warehouse-dialog';

export default async function WarehousesPage() {
  const { tenant } = await getCurrentStaffContext();
  const warehouses = await listWarehouses(tenant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Physical locations where your team receives and stores inventory. Each warehouse has zones, aisles, and bins."
        action={<CreateWarehouseDialog />}
        helpKey="warehouse.warehouses"
      />

      {warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add your first warehouse to start receiving inventory. You'll add zones, aisles, and bins after."
          action={<CreateWarehouseDialog />}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/warehouse/warehouses/${w.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {w.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {w.address ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-sm">
                    {w.createdAt.toLocaleDateString()}
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
