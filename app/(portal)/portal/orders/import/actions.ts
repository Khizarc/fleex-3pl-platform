'use server';

// Portal-side server actions for bulk CSV order import (Milestone 1.6 + 1.7).
//
// Endpoints:
//   - resolveSkusAction(codes)  — flag unknown SKUs in the preview.
//   - resolvePersonalizationFieldsAction() — surface the client's active
//     personalization definitions so the validator can recognize columns
//     and flag unknown / disabled / missing-required values pre-commit.
//   - importOrdersAction(orders) — re-validates client-supplied groups,
//     re-resolves SKUs + definitions server-side as the source of truth,
//     then runs the serial bulkCreateOrders. Never throws.

import { z } from 'zod';
import { getCurrentClientContext } from '@/lib/auth';
import { bulkCreateOrders, type BulkCreateOrdersResult } from '@/features/orders';
import { listActivePersonalizationFields } from '@/features/personalization';
import { resolveSkusByCode } from '@/features/products';

const groupedOrderSchema = z.object({
  groupKey: z.string().min(1).max(200),
  rowNumbers: z.array(z.number().int()).min(1),
  shipTo: z.object({
    name: z.string().trim().min(1).max(120),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().length(2),
  }),
  customerNote: z.string().trim().max(2000).optional(),
  lines: z
    .array(
      z.object({
        skuId: z.string().min(1),
        skuCode: z.string().min(1),
        quantity: z.number().int().positive(),
        personalization: z.record(z.string(), z.string().max(500)).optional(),
      }),
    )
    .min(1),
});

const MAX_GROUPS = 1000;

export async function resolveSkusAction(
  codes: string[],
): Promise<Record<string, { id: string; name: string } | null>> {
  if (!Array.isArray(codes) || codes.length === 0) return {};
  if (codes.length > 5000) return {};
  const { tenant } = await getCurrentClientContext();
  const map = await resolveSkusByCode(tenant, codes);
  return Object.fromEntries(map);
}

export type ResolvedPersonalizationField = {
  id: string;
  key: string;
  label: string;
  required: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
};

export async function resolvePersonalizationFieldsAction(): Promise<
  ResolvedPersonalizationField[]
> {
  const { tenant } = await getCurrentClientContext();
  // Active only — preview should match createOrder semantics. Disabled
  // fields surface as "unknown column" errors in the validator which is
  // honest: the user can't capture them anyway.
  const fields = await listActivePersonalizationFields(tenant);
  return fields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    required: f.required,
    status: f.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
  }));
}

type ImportResult = { ok: true; data: BulkCreateOrdersResult } | { ok: false; error: string };

export async function importOrdersAction(orders: unknown[]): Promise<ImportResult> {
  if (!Array.isArray(orders)) {
    return { ok: false, error: 'Invalid payload: expected an array of orders.' };
  }
  if (orders.length === 0) {
    return { ok: false, error: 'No orders to import.' };
  }
  if (orders.length > MAX_GROUPS) {
    return { ok: false, error: `Too many orders: max ${MAX_GROUPS} per file.` };
  }

  const parsed = z.array(groupedOrderSchema).safeParse(orders);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid import payload',
    };
  }

  const { tenant, client, clientUser } = await getCurrentClientContext();

  const allCodes = parsed.data.flatMap((o) => o.lines.map((l) => l.skuCode));
  const skuMap = await resolveSkusByCode(tenant, allCodes);

  const resolvedOrders = parsed.data.map((o) => ({
    ...o,
    lines: o.lines.map((l) => ({
      skuId: skuMap.get(l.skuCode)?.id ?? l.skuId,
      skuCode: l.skuCode,
      quantity: l.quantity,
      personalization: l.personalization,
    })),
  }));

  // createOrder re-validates personalization against the client's current
  // active fields inside its own transaction — no extra plumbing needed here.
  const result = await bulkCreateOrders(tenant, {
    clientId: client.id,
    createdByClientUserId: clientUser.id,
    orders: resolvedOrders,
  });

  return { ok: true, data: result };
}
