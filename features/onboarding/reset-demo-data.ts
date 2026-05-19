import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import { DEMO_CLIENT_NAME, DEMO_WAREHOUSE_NAME } from './seed-demo-data';

// Tears down the demo seed cleanly. Anything the user created themselves on
// top is preserved — we only touch rows for the demo client + demo warehouse.
//
// Deletion order matters because three relations are RESTRICT, not CASCADE:
//   - StockLevel → SKU (Restrict)
//   - OrderLinePersonalization → PersonalizationField (Restrict)
//   - InboundShipmentLine → SKU + Bin (Restrict)
//   - OrderLineAllocation → Bin (Restrict)
// So we explicitly drop the dependents before letting Client/Warehouse cascade.
export async function resetDemoData(ctx: TenantContext): Promise<void> {
  await withTenantContext(ctx, async (tx) => {
    const demoClient = await tx.client.findFirst({
      where: { name: DEMO_CLIENT_NAME },
      select: { id: true },
    });
    const demoWarehouse = await tx.warehouse.findFirst({
      where: { name: DEMO_WAREHOUSE_NAME },
      select: { id: true },
    });

    if (demoClient) {
      const cid = demoClient.id;
      // 1. Drop personalization values (Restrict on PersonalizationField).
      await tx.orderLinePersonalization.deleteMany({ where: { clientId: cid } });
      // 2. Drop allocations (Restrict on Bin).
      await tx.orderLineAllocation.deleteMany({ where: { clientId: cid } });
      // 3. Drop order lines + orders.
      await tx.orderLineItem.deleteMany({ where: { clientId: cid } });
      await tx.order.deleteMany({ where: { clientId: cid } });
      // 4. Drop inbound lines (Restrict on SKU + Bin) + inbound shipments.
      await tx.inboundShipmentLine.deleteMany({ where: { clientId: cid } });
      await tx.inboundShipment.deleteMany({ where: { clientId: cid } });
      // 5. Drop stock levels (Restrict on SKU).
      await tx.stockLevel.deleteMany({ where: { clientId: cid } });
      // 6. Now PersonalizationField + SKU have no inbound references; safe to
      //    let Client cascade through Product → SKU and PersonalizationField.
      await tx.personalizationField.deleteMany({ where: { clientId: cid } });
      await tx.client.delete({ where: { id: cid } });
    }

    if (demoWarehouse) {
      // Bin has Restrict on OrderLineAllocation + InboundShipmentLine + StockLevel,
      // but all three are gone (deleted via the client above). Warehouse cascades
      // through Zone → Aisle → Bin cleanly now.
      await tx.warehouse.delete({ where: { id: demoWarehouse.id } });
    }
  });
}
