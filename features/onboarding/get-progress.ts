import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

export type OnboardingProgress = {
  warehouseCreated: boolean;
  clientCreated: boolean;
  skuCreated: boolean;
  clientUserInvited: boolean;
  inboundReceived: boolean;
};

// Derived view over existing tables — no schema. Five parallel COUNT queries
// inside a single tenant transaction so RLS scopes everything to the calling
// company. Truthy = the user has completed that step at least once.
export async function getOnboardingProgress(ctx: TenantContext): Promise<OnboardingProgress> {
  return withTenantContext(ctx, async (tx) => {
    const [warehouseCount, clientCount, skuCount, clientUserCount, inboundDoneCount] =
      await Promise.all([
        tx.warehouse.count(),
        tx.client.count(),
        tx.sKU.count(),
        tx.clientUser.count(),
        tx.inboundShipment.count({
          where: {
            status: {
              in: ['RECEIVING', 'COMPLETED', 'COMPLETED_WITH_DISCREPANCIES'],
            },
          },
        }),
      ]);

    return {
      warehouseCreated: warehouseCount > 0,
      clientCreated: clientCount > 0,
      skuCreated: skuCount > 0,
      clientUserInvited: clientUserCount > 0,
      inboundReceived: inboundDoneCount > 0,
    };
  });
}
