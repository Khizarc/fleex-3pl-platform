import { Boxes } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { listInventoryBySku } from '@/features/inventory';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';

export default async function StaffInventoryPage() {
  const { tenant } = await getCurrentStaffContext();
  const [rows, pendingInbounds] = await Promise.all([
    listInventoryBySku(tenant),
    withTenantContext(tenant, async (tx) =>
      tx.inboundShipment.count({ where: { status: { in: ['NOTIFIED', 'RECEIVING'] } } }),
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock on hand across all clients, summed per SKU. Levels update when inbound shipments are received and when orders are picked."
        helpKey="warehouse.inventory"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock yet"
          description={
            pendingInbounds > 0
              ? `Inventory appears here once you receive an inbound shipment. You have ${pendingInbounds} pending — start receiving them now.`
              : 'Inventory appears here once your team receives an inbound shipment from a client.'
          }
          action={
            <Button asChild>
              <Link href="/warehouse/inbound-shipments">
                {pendingInbounds > 0
                  ? `View ${pendingInbounds} pending inbound${pendingInbounds === 1 ? '' : 's'}`
                  : 'View inbound shipments'}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <InventoryTable rows={rows} showClient={true} />
        </div>
      )}
    </div>
  );
}
