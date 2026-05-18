import { Boxes } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { listInventoryBySku } from '@/features/inventory';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function StaffInventoryPage() {
  const { tenant } = await getCurrentStaffContext();
  const rows = await listInventoryBySku(tenant);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground text-sm">
          Stock on hand across all clients, summed per SKU.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock yet"
          description="Inventory shows up here once your team starts receiving inbound shipments."
        />
      ) : (
        <div className="rounded-lg border">
          <InventoryTable rows={rows} showClient={true} />
        </div>
      )}
    </div>
  );
}
