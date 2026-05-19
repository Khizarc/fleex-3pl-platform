import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { listInventoryBySku } from '@/features/inventory';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalInventoryPage() {
  const { tenant, client } = await getCurrentClientContext();
  const rows = await listInventoryBySku(tenant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${client.name}'s stock on hand, summed per SKU across all bins. Updates when your 3PL receives inbound shipments.`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock yet"
          description="Inventory shows up here once your 3PL receives an inbound shipment from you. Notify them what's coming."
          action={
            <Button asChild>
              <Link href="/portal/inbound-shipments/new">Notify of incoming</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <InventoryTable rows={rows} showClient={false} />
        </div>
      )}
    </div>
  );
}
