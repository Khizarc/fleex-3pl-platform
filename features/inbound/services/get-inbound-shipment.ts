import type {
  Bin,
  Client,
  Company,
  InboundShipment,
  InboundShipmentLine,
  SKU,
  User,
  Warehouse,
} from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type InboundShipmentDetail = InboundShipment & {
  client: Client & { company: Company };
  warehouse: Warehouse;
  lines: (InboundShipmentLine & {
    sku: SKU;
    bin: Bin | null;
    receivedBy: Pick<User, 'id' | 'name' | 'email'> | null;
  })[];
};

export async function getInboundShipment(
  ctx: TenantContext,
  id: string,
): Promise<InboundShipmentDetail | null> {
  return withTenantContext(ctx, async (tx) => {
    return tx.inboundShipment.findUnique({
      where: { id },
      include: {
        client: { include: { company: true } },
        warehouse: true,
        lines: {
          include: {
            sku: true,
            bin: true,
            receivedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  });
}
