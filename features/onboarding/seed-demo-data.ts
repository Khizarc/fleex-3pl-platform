import { InboundShipmentStatus, OrderStatus, StockLevelStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Demo data uses these well-known names/references so the reset helper can
// find and delete it without ambiguity. Anything else the user creates stays.
export const DEMO_WAREHOUSE_NAME = 'Demo Distribution Center';
export const DEMO_CLIENT_NAME = 'Acme Demo Co';
export const DEMO_CLIENT_USER_EMAIL = 'demo-client@example.test';
export const DEMO_INBOUND_REF = 'INB-DEMO-001';
export const DEMO_ORDER_PREFIX = 'ORD-DEMO-';

export class DemoDataAlreadyExistsError extends Error {
  constructor() {
    super('Demo data is already loaded for this company. Reset it first to reload.');
    this.name = 'DemoDataAlreadyExistsError';
  }
}

// Returns true if the demo warehouse exists in the caller's tenant.
export async function hasDemoData(ctx: TenantContext): Promise<boolean> {
  return withTenantContext(ctx, async (tx) => {
    const wh = await tx.warehouse.findFirst({
      where: { name: DEMO_WAREHOUSE_NAME },
      select: { id: true },
    });
    return wh !== null;
  });
}

// Populates the caller's tenant with a fully populated demo: 1 warehouse with
// 6 bins, 1 client with portal-user invite + personalization field, 3 products
// / 6 SKUs, 1 received inbound shipment (so inventory is real), and 1
// SUBMITTED order with a personalization value. The flow is now click-through
// explorable: allocate the order → pick from bins → pack → ship.
export async function seedDemoData(
  ctx: TenantContext,
  args: { receivedByUserId: string },
): Promise<void> {
  if (await hasDemoData(ctx)) {
    throw new DemoDataAlreadyExistsError();
  }

  await withTenantContext(ctx, async (tx) => {
    // --- Warehouse → Zone → Aisle → 6 Bins ---
    const wh = await tx.warehouse.create({
      data: {
        name: DEMO_WAREHOUSE_NAME,
        address: '123 Demo Way, Brooklyn, NY 11201',
        companyId: ctx.companyId,
      },
    });
    const zone = await tx.zone.create({
      data: { name: 'Main', warehouseId: wh.id, companyId: ctx.companyId },
    });
    const aisle = await tx.aisle.create({
      data: { name: 'A1', zoneId: zone.id, companyId: ctx.companyId },
    });
    const binLabels = ['A1-01', 'A1-02', 'A1-03', 'A1-04', 'A1-05', 'A1-06'];
    const bins = await Promise.all(
      binLabels.map((label) =>
        tx.bin.create({
          data: { label, aisleId: aisle.id, companyId: ctx.companyId },
        }),
      ),
    );

    // --- Client + portal user invite + personalization field ---
    const client = await tx.client.create({
      data: { name: DEMO_CLIENT_NAME, companyId: ctx.companyId },
    });
    await tx.clientUser.create({
      data: {
        email: DEMO_CLIENT_USER_EMAIL,
        name: 'Demo Portal User',
        clientId: client.id,
        companyId: ctx.companyId,
      },
    });
    const engravingField = await tx.personalizationField.create({
      data: {
        key: 'engraving',
        label: 'Engraving text',
        required: true,
        clientId: client.id,
        companyId: ctx.companyId,
      },
    });

    // --- 3 products with 2 SKUs each ---
    const productSpecs = [
      {
        name: 'Engraved Tumbler',
        description: '20oz steel tumbler — laser-engraved.',
        skus: [
          { code: 'DEMO-TUM-BLUE', name: 'Blue tumbler' },
          { code: 'DEMO-TUM-RED', name: 'Red tumbler' },
        ],
      },
      {
        name: 'Logo Hoodie',
        description: 'Cotton hoodie with embroidered logo.',
        skus: [
          { code: 'DEMO-HOOD-S', name: 'Hoodie — small' },
          { code: 'DEMO-HOOD-L', name: 'Hoodie — large' },
        ],
      },
      {
        name: 'Gift Box',
        description: 'Pre-curated gift box for new customers.',
        skus: [
          { code: 'DEMO-BOX-STD', name: 'Gift box — standard' },
          { code: 'DEMO-BOX-PREM', name: 'Gift box — premium' },
        ],
      },
    ];

    const skuByCode: Record<string, { id: string }> = {};
    for (const spec of productSpecs) {
      const product = await tx.product.create({
        data: {
          name: spec.name,
          description: spec.description,
          clientId: client.id,
          companyId: ctx.companyId,
        },
      });
      for (const s of spec.skus) {
        const sku = await tx.sKU.create({
          data: {
            code: s.code,
            name: s.name,
            productId: product.id,
            clientId: client.id,
            companyId: ctx.companyId,
          },
        });
        skuByCode[s.code] = { id: sku.id };
      }
    }

    // --- Received inbound shipment ---
    // 3 lines into 3 different bins, all received. This materializes
    // AVAILABLE StockLevel rows the user can immediately see in inventory.
    const inbound = await tx.inboundShipment.create({
      data: {
        reference: DEMO_INBOUND_REF,
        status: InboundShipmentStatus.COMPLETED,
        clientId: client.id,
        companyId: ctx.companyId,
        warehouseId: wh.id,
      },
    });

    const receivedAt = new Date();
    const receiveSpec = [
      { code: 'DEMO-TUM-BLUE', bin: bins[0]!.id, qty: 25 },
      { code: 'DEMO-TUM-RED', bin: bins[1]!.id, qty: 15 },
      { code: 'DEMO-HOOD-S', bin: bins[2]!.id, qty: 20 },
    ];
    for (const r of receiveSpec) {
      await tx.inboundShipmentLine.create({
        data: {
          inboundShipmentId: inbound.id,
          skuId: skuByCode[r.code]!.id,
          expectedQuantity: r.qty,
          actualQuantity: r.qty,
          binId: r.bin,
          receivedAt,
          receivedByUserId: args.receivedByUserId,
          clientId: client.id,
          companyId: ctx.companyId,
        },
      });
      await tx.stockLevel.upsert({
        where: {
          skuId_binId_status: {
            skuId: skuByCode[r.code]!.id,
            binId: r.bin,
            status: StockLevelStatus.AVAILABLE,
          },
        },
        create: {
          skuId: skuByCode[r.code]!.id,
          binId: r.bin,
          status: StockLevelStatus.AVAILABLE,
          quantity: r.qty,
          clientId: client.id,
          companyId: ctx.companyId,
        },
        update: { quantity: { increment: r.qty } },
      });
    }

    // --- A SUBMITTED order awaiting allocation (with personalization) ---
    await tx.order.create({
      data: {
        reference: `${DEMO_ORDER_PREFIX}001`,
        status: OrderStatus.SUBMITTED,
        clientId: client.id,
        companyId: ctx.companyId,
        shipToName: 'Sam Sample',
        shipToLine1: '500 Demo Lane',
        shipToCity: 'Austin',
        shipToRegion: 'TX',
        shipToPostalCode: '78701',
        shipToCountry: 'US',
        customerNote: 'Demo order — try allocating, picking, packing, and shipping it.',
        lines: {
          create: [
            {
              skuId: skuByCode['DEMO-TUM-BLUE']!.id,
              quantity: 2,
              clientId: client.id,
              companyId: ctx.companyId,
              personalizations: {
                create: [
                  {
                    fieldId: engravingField.id,
                    fieldKey: 'engraving',
                    value: 'For Sam',
                    clientId: client.id,
                    companyId: ctx.companyId,
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });
}
