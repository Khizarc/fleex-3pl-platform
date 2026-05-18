import { StockLevelStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type InventoryRow = {
  skuId: string;
  skuCode: string;
  skuName: string;
  productName: string;
  clientId: string;
  clientName: string;
  available: number;
  reserved: number;
  onHold: number;
  damaged: number;
  total: number;
};

// Aggregates StockLevel rows into one row per SKU, with quantities split by
// status. RLS does the visibility filter:
//   - staff context: every SKU with any stock across all clients of the company
//   - portal context: only the own-client's SKUs with stock
//
// Two queries:
//   1. groupBy (skuId, status) → SUM(quantity). Linear in (skuId × status)
//      tuples that have at least one row.
//   2. findMany on SKUs with the IDs that appeared, plus Product + Client
//      info for display.
//
// Then pivot in JS: one row per SKU with columns per status.
export async function listInventoryBySku(ctx: TenantContext): Promise<InventoryRow[]> {
  return withTenantContext(ctx, async (tx) => {
    const grouped = await tx.stockLevel.groupBy({
      by: ['skuId', 'status'],
      _sum: { quantity: true },
    });

    if (grouped.length === 0) return [];

    const skuIds = Array.from(new Set(grouped.map((g) => g.skuId)));
    const skus = await tx.sKU.findMany({
      where: { id: { in: skuIds } },
      include: {
        product: { select: { name: true } },
        // Note: `Client` doesn't have a direct relation on SKU; SKU has
        // clientId so we look up the Client separately via a single findMany
        // below to avoid an N+1.
      },
    });
    const clientIds = Array.from(new Set(skus.map((s) => s.clientId)));
    const clients = await tx.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });
    const clientById = new Map(clients.map((c) => [c.id, c.name]));

    // Pivot: bucket grouped results by skuId, then read by status.
    const byStatus = new Map<string, Map<StockLevelStatus, number>>();
    for (const row of grouped) {
      const inner = byStatus.get(row.skuId) ?? new Map();
      inner.set(row.status, row._sum.quantity ?? 0);
      byStatus.set(row.skuId, inner);
    }

    const rows: InventoryRow[] = skus.map((sku) => {
      const buckets = byStatus.get(sku.id) ?? new Map<StockLevelStatus, number>();
      const available = buckets.get(StockLevelStatus.AVAILABLE) ?? 0;
      const reserved = buckets.get(StockLevelStatus.RESERVED) ?? 0;
      const onHold = buckets.get(StockLevelStatus.ON_HOLD) ?? 0;
      const damaged = buckets.get(StockLevelStatus.DAMAGED) ?? 0;
      return {
        skuId: sku.id,
        skuCode: sku.code,
        skuName: sku.name,
        productName: sku.product.name,
        clientId: sku.clientId,
        clientName: clientById.get(sku.clientId) ?? '—',
        available,
        reserved,
        onHold,
        damaged,
        total: available + reserved + onHold + damaged,
      };
    });

    return rows.sort((a, b) => a.skuCode.localeCompare(b.skuCode));
  });
}
