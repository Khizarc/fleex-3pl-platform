import { Boxes } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { listInventoryBySku } from '@/features/inventory';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalInventoryPage() {
  const { tenant, client } = await getCurrentClientContext();
  const rows = await listInventoryBySku(tenant);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground text-sm">
          {client.name}&apos;s stock on hand, summed per SKU across all bins.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock yet"
          description="Inventory shows up here once your 3PL receives an inbound shipment from you."
        />
      ) : (
        <div className="rounded-lg border">
          <InventoryTable rows={rows} showClient={false} />
        </div>
      )}
    </div>
  );
}
