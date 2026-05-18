import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Order detail shaped for the pick screen. Returns the order with each line
// flattened into a list of allocations enriched with bin location info
// (zone → aisle → bin label) and pick state. Allocations are sorted so the
// picker walks zones in order, then aisles, then bin labels — a single
// pass through the warehouse instead of zigzag.
//
// Already-picked allocations remain in the list so the picker can see what
// they've already done (greyed-out + checkmark in the UI).
export async function getPickList(ctx: TenantContext, orderId: string) {
  return withTenantContext(ctx, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        client: { select: { id: true, name: true } },
        lines: {
          include: {
            sku: { select: { id: true, code: true, name: true } },
            personalizations: { orderBy: { fieldKey: 'asc' } },
            allocations: {
              include: {
                bin: {
                  select: {
                    id: true,
                    label: true,
                    status: true,
                    aisle: {
                      select: {
                        id: true,
                        name: true,
                        zone: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
                pickedBy: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Flatten and sort so the picker walks the warehouse in order.
    const allocations = order.lines
      .flatMap((line) =>
        line.allocations.map((alloc) => ({
          ...alloc,
          line: {
            id: line.id,
            quantity: line.quantity,
            sku: line.sku,
            personalizations: line.personalizations,
          },
        })),
      )
      .sort((a, b) => {
        const z = a.bin.aisle.zone.name.localeCompare(b.bin.aisle.zone.name);
        if (z !== 0) return z;
        const ai = a.bin.aisle.name.localeCompare(b.bin.aisle.name);
        if (ai !== 0) return ai;
        return a.bin.label.localeCompare(b.bin.label);
      });

    return { order, allocations };
  });
}

export type PickListItem = Awaited<ReturnType<typeof getPickList>>['allocations'][number];
