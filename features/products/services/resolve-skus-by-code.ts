import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';

// Given a list of SKU codes, return `{ code → {id, name} | null }` for the
// caller's tenant. Used by the bulk-import flow to validate that every SKU
// in a CSV exists in the caller's catalog.
//
// RLS does the heavy lifting:
//   - Portal context (clientId set in ctx) → returns only own-client SKUs.
//   - Staff context (no clientId in ctx) → returns SKUs across all the
//     company's clients; pass an optional `clientId` arg to additionally
//     restrict to that client.
//
// SKU codes are unique per client (`@@unique([clientId, code])`) but NOT
// across the company. In a staff lookup without a clientId, two different
// clients could legitimately have the same code; the caller (the bulk
// import) always picks a single client first, so this case doesn't arise.
export async function resolveSkusByCode(
  ctx: TenantContext,
  codes: string[],
  options: { clientId?: string } = {},
): Promise<Map<string, { id: string; name: string } | null>> {
  const result = new Map<string, { id: string; name: string } | null>();
  const unique = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
  if (unique.length === 0) return result;

  for (const code of unique) result.set(code, null);

  await withTenantContext(ctx, async (tx) => {
    const rows = await tx.sKU.findMany({
      where: {
        code: { in: unique },
        ...(options.clientId ? { clientId: options.clientId } : {}),
      },
      select: { id: true, name: true, code: true },
    });
    for (const r of rows) {
      result.set(r.code, { id: r.id, name: r.name });
    }
  });

  return result;
}
