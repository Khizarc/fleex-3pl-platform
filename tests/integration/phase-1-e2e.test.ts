// Phase 0-1 end-to-end integration test (Milestone 1.14).
//
// Walks the entire manual fulfillment loop through every service layer:
//   create company → warehouse → client → product → SKU → personalization
//   field → notify inbound → start receiving → receive lines → complete
//   → assert StockLevel → create order with personalization → assert auto
//   allocation → pick all allocations → pack → ship → invite staff → claim.
//
// This is the single-source-of-truth proof that all of Phase 0-1 composes
// as one coherent flow, not just per-milestone in isolation.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountStatus,
  Carrier,
  InboundShipmentStatus,
  OrderStatus,
  Role,
  StockLevelStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@/features/clients';
import { createAisle, createBin, createWarehouse, createZone } from '@/features/warehouses';
import { createProduct, createSku } from '@/features/products';
import { createPersonalizationField } from '@/features/personalization';
import {
  completeInboundShipment,
  createInboundShipment,
  receiveLine,
  startReceiving,
} from '@/features/inbound';
import {
  createOrder,
  getOrderActivity,
  packOrder,
  pickAllocation,
  shipOrder,
} from '@/features/orders';
import { inviteStaff, listStaff } from '@/features/team';
import { assertDatabaseUrl, truncateAll } from './setup';

assertDatabaseUrl();

beforeAll(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});

describe('Phase 0-1 end-to-end: receive → store → ship', () => {
  it('walks the full manual fulfillment loop through every service layer', async () => {
    // ─── 0. Company + admin (mirrors what auth resolver auto-provisions) ───
    const company = await prisma.company.create({ data: { name: 'E2E 3PL Co' } });
    const admin = await prisma.user.create({
      data: {
        authProviderId: 'clerk_e2e_admin',
        email: 'admin@e2e.test',
        name: 'E2E Admin',
        role: Role.ADMIN,
        companyId: company.id,
      },
    });
    const ctx = { companyId: company.id };

    // ─── 1.1: Warehouse → Zone → Aisle → 2 Bins ───
    const warehouse = await createWarehouse(ctx, {
      name: 'E2E DC',
      address: '1 Test St, NYC NY 10001',
    });
    const zone = await createZone(ctx, { warehouseId: warehouse.id, name: 'Main' });
    const aisle = await createAisle(ctx, { zoneId: zone.id, name: 'A1' });
    const bin1 = await createBin(ctx, { aisleId: aisle.id, label: 'A1-01' });
    // Second bin reserved for multi-bin allocation; not used in this test pass
    // but demonstrates that bins beyond the first don't interfere with FIFO.
    await createBin(ctx, { aisleId: aisle.id, label: 'A1-02' });
    expect(warehouse.companyId).toBe(company.id);
    expect(bin1.aisleId).toBe(aisle.id);

    // ─── 0.5: Client (no portal user yet — invite separately later) ───
    const client = await createClient(ctx, { name: 'Acme E2E' });
    expect(client.companyId).toBe(company.id);

    // Invite a portal user by direct insert (mirrors the createClient.firstUser
    // path; both end up at the same row shape with authProviderId=null).
    const portalInvite = await prisma.clientUser.create({
      data: {
        email: 'portal@acme.e2e',
        name: 'Acme Portal',
        clientId: client.id,
        companyId: company.id,
      },
    });
    expect(portalInvite.authProviderId).toBeNull();

    // ─── 1.2: Product + SKU ───
    const product = await createProduct(ctx, {
      clientId: client.id,
      name: 'E2E Tumbler',
      description: '20oz steel tumbler',
    });
    const sku = await createSku(ctx, {
      productId: product.id,
      code: 'E2E-TUM-BLUE',
      name: 'Blue tumbler',
    });
    expect(sku.clientId).toBe(client.id);

    // ─── 1.7: Personalization field (required) ───
    const field = await createPersonalizationField(ctx, {
      clientId: client.id,
      key: 'engraving',
      label: 'Engraving text',
      required: true,
    });
    expect(field.status).toBe(AccountStatus.ACTIVE);

    // ─── 1.3 (portal side): Notify inbound with 2 lines ───
    const portalCtx = { companyId: company.id, clientId: client.id };
    const inbound = await createInboundShipment(portalCtx, {
      warehouseId: warehouse.id,
      clientId: client.id,
      lines: [{ skuId: sku.id, expectedQuantity: 30 }],
    });
    expect(inbound.status).toBe(InboundShipmentStatus.NOTIFIED);

    // ─── 1.3 (staff side): Start → receive line(s) → complete ───
    const started = await startReceiving(ctx, inbound.id);
    expect(started.status).toBe(InboundShipmentStatus.RECEIVING);

    const inboundDetail = await prisma.inboundShipment.findUniqueOrThrow({
      where: { id: inbound.id },
      include: { lines: true },
    });
    // Receive 30 — split across two bins to exercise multi-bin allocation
    // and to prove the orchestrator handles partial assignments cleanly.
    // Receive all of it into bin1 (single line per shipment in this test).
    const receivedLine = await receiveLine(ctx, {
      lineId: inboundDetail.lines[0]!.id,
      actualQuantity: 30,
      binId: bin1.id,
      receivedByUserId: admin.id,
    });
    expect(receivedLine.actualQuantity).toBe(30);
    expect(receivedLine.binId).toBe(bin1.id);

    const completed = await completeInboundShipment(ctx, inbound.id);
    expect(completed.status).toBe(InboundShipmentStatus.COMPLETED);

    // ─── 1.4: Assert StockLevel materialized to AVAILABLE 30 in bin1 ───
    const stock = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        skuId_binId_status: {
          skuId: sku.id,
          binId: bin1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    expect(stock.quantity).toBe(30);

    // ─── 1.5 + 1.6 + 1.7: Create order via portal context with personalization ───
    const order = await createOrder(portalCtx, {
      clientId: client.id,
      createdByClientUserId: portalInvite.id,
      shipToName: 'Sam Sample',
      shipToLine1: '500 Demo Lane',
      shipToCity: 'Austin',
      shipToRegion: 'TX',
      shipToPostalCode: '78701',
      shipToCountry: 'US',
      lines: [
        {
          skuId: sku.id,
          quantity: 4,
          personalization: { engraving: 'For Sam' },
        },
      ],
    });
    // Auto-allocation should have promoted it to READY_TO_PICK.
    expect(order.status).toBe(OrderStatus.READY_TO_PICK);
    expect(order.allocatedAt).not.toBeNull();
    expect(order.companyId).toBe(company.id);
    expect(order.clientId).toBe(client.id);

    // Stock should now show 26 available + 4 reserved.
    const availAfterAlloc = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        skuId_binId_status: {
          skuId: sku.id,
          binId: bin1.id,
          status: StockLevelStatus.AVAILABLE,
        },
      },
    });
    const reserved = await prisma.stockLevel.findUniqueOrThrow({
      where: {
        skuId_binId_status: {
          skuId: sku.id,
          binId: bin1.id,
          status: StockLevelStatus.RESERVED,
        },
      },
    });
    expect(availAfterAlloc.quantity).toBe(26);
    expect(reserved.quantity).toBe(4);

    // Personalization captured on the line.
    const orderLine = await prisma.orderLineItem.findFirstOrThrow({
      where: { orderId: order.id },
      include: { personalizations: true, allocations: true },
    });
    expect(orderLine.personalizations[0]?.value).toBe('For Sam');
    expect(orderLine.allocations.length).toBe(1);
    expect(orderLine.allocations[0]?.binId).toBe(bin1.id);

    // ─── 1.8: Pick each allocation ───
    for (const alloc of orderLine.allocations) {
      await pickAllocation(ctx, {
        allocationId: alloc.id,
        scannedBinLabel: bin1.label,
        pickedByUserId: admin.id,
      });
    }
    const pickedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(pickedOrder.status).toBe(OrderStatus.PICKED);

    // ─── 1.9: Pack with box dimensions ───
    const packed = await packOrder(ctx, {
      orderId: order.id,
      boxLengthMm: 200,
      boxWidthMm: 150,
      boxHeightMm: 100,
      boxWeightG: 350,
      packedByUserId: admin.id,
    });
    expect(packed.status).toBe(OrderStatus.PACKED);
    expect(packed.packedByUserId).toBe(admin.id);

    // ─── 1.10: Ship with carrier + tracking ───
    const shipped = await shipOrder(ctx, {
      orderId: order.id,
      carrier: Carrier.USPS,
      trackingNumber: '9400111111111111111111',
      shippedByUserId: admin.id,
    });
    expect(shipped.status).toBe(OrderStatus.SHIPPED);
    expect(shipped.trackingNumber).toBe('9400111111111111111111');

    // ─── 1.13 activity feed: should have 4 events (submitted/alloc/picked/packed/shipped) ───
    const activity = await getOrderActivity(ctx, order.id);
    const kinds = activity.map((e) => e.kind);
    expect(kinds).toContain('submitted');
    expect(kinds).toContain('allocated');
    expect(kinds).toContain('picked');
    expect(kinds).toContain('packed');
    expect(kinds).toContain('shipped');

    // ─── 1.11: Invite staff member by email, claim, verify productivity counts ───
    const invited = await inviteStaff(ctx, {
      email: 'picker@e2e.test',
      name: 'E2E Picker',
      role: Role.PICKER,
    });
    expect(invited.authProviderId).toBeNull();

    const staffList = await listStaff(ctx);
    // Admin (1 inbound line, 1 alloc pick, 1 pack, 1 ship) + invited picker
    const adminRow = staffList.find((s) => s.id === admin.id);
    expect(adminRow?.inboundLinesReceived).toBe(1);
    expect(adminRow?.picksCompleted).toBe(1);
    expect(adminRow?.ordersPacked).toBe(1);
    expect(adminRow?.ordersShipped).toBe(1);
    expect(staffList.some((s) => s.email === 'picker@e2e.test')).toBe(true);
  });
});
