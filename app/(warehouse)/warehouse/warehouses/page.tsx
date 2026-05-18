import Link from 'next/link';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
          <p className="text-muted-foreground text-sm">
            Physical locations where your team receives and stores inventory.
          </p>
        </div>
        <CreateWarehouseDialog />
      </div>

      {warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add your first warehouse, then define its zones, aisles, and bins."
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
