import type { InboundShipment, InboundShipmentStatus } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type InboundShipmentRow = InboundShipment & {
  client: { id: string; name: string };
  warehouse: { id: string; name: string };
  _count: { lines: number };
};

export async function listInboundShipments(
  ctx: TenantContext,
  options: { statuses?: InboundShipmentStatus[] } = {},
): Promise<InboundShipmentRow[]> {
  return withTenantContext(ctx, async (tx) => {
    return tx.inboundShipment.findMany({
      where: options.statuses ? { status: { in: options.statuses } } : {},
      include: {
        client: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}
