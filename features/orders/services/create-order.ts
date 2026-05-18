import { AccountStatus, OrderStatus, Prisma } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import { prisma } from '@/lib/db/prisma';
import type { TenantContext } from '@/lib/tenancy';
import { assertTransition } from '../state-machine';
import type { CreateOrderInput } from '../validation';
import { runAllocation } from './allocate-lines';

// Public createOrder. Used by both the portal (clientId resolved from the
// portal context) and the staff shell (clientId chosen by staff, plus a
// createdByUserId for audit).
//
// Reference generation runs as the schema owner so it sees every order in
// the company (RLS-scoped reads would only see the caller's own client's
// orders and would collide on the (companyId, reference) unique index when
// a different client also creates an order the same day). Insert + allocation
// then happen inside a tenant-scoped transaction; on the small race window
// where two callers picked the same number, the unique index rejects one
// and we retry with the next number.
export async function createOrder(
  ctx: TenantContext,
  args: CreateOrderInput & {
    clientId: string;
    createdByUserId?: string;
    createdByClientUserId?: string;
  },
) {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const reference = await peekNextReference(args.clientId);
    try {
      return await insertAndAllocate(ctx, args, reference);
    } catch (err) {
      if (isReferenceCollision(err) && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  // Unreachable — the loop either returns or throws.
  throw new Error('Failed to generate a unique order reference after retries.');
}

async function insertAndAllocate(
  ctx: TenantContext,
  args: CreateOrderInput & {
    clientId: string;
    createdByUserId?: string;
    createdByClientUserId?: string;
  },
  reference: string,
) {
  return withTenantContext(ctx, async (tx) => {
    const client = await tx.client.findUniqueOrThrow({
      where: { id: args.clientId },
      select: { id: true, companyId: true },
    });

    const uniqueSkuIds = Array.from(new Set(args.lines.map((l) => l.skuId)));
    if (uniqueSkuIds.length !== args.lines.length) {
      throw new Error('Each SKU may appear at most once per order.');
    }

    const skus = await tx.sKU.findMany({
      where: { id: { in: uniqueSkuIds }, clientId: client.id },
      select: { id: true },
    });
    if (skus.length !== uniqueSkuIds.length) {
      throw new Error('One or more SKUs do not belong to this client.');
    }

    // Personalization validation (1.7) — load the client's ACTIVE field
    // definitions and verify every supplied key resolves, every required
    // field is present, and every value is within length cap. Validation
    // happens BEFORE we write any order data so failure is atomic.
    const activeFields = await tx.personalizationField.findMany({
      where: { clientId: client.id, status: AccountStatus.ACTIVE },
      select: { id: true, key: true, required: true },
    });
    const activeByKey = new Map(activeFields.map((f) => [f.key, f]));
    const linePersonalization = args.lines.map((line) => {
      const supplied = line.personalization ?? {};
      // Reject unknown keys
      for (const key of Object.keys(supplied)) {
        if (!activeByKey.has(key)) {
          throw new Error(`Unknown personalization key: "${key}"`);
        }
      }
      // Require all required fields. Empty string counts as absent.
      for (const field of activeFields) {
        if (!field.required) continue;
        const value = (supplied[field.key] ?? '').trim();
        if (value.length === 0) {
          throw new Error(`Personalization field "${field.key}" is required.`);
        }
      }
      // Build the (non-empty) value records to write after lines exist.
      const toWrite: Array<{ fieldId: string; fieldKey: string; value: string }> = [];
      for (const [key, rawValue] of Object.entries(supplied)) {
        const value = (rawValue ?? '').trim();
        if (value.length === 0) continue;
        if (value.length > 500) {
          throw new Error(`Personalization "${key}" exceeds 500 characters.`);
        }
        const field = activeByKey.get(key)!;
        toWrite.push({ fieldId: field.id, fieldKey: field.key, value });
      }
      return { skuId: line.skuId, toWrite };
    });

    const created = await tx.order.create({
      data: {
        reference,
        status: OrderStatus.SUBMITTED,
        customerNote: args.customerNote,
        shipToName: args.shipToName,
        shipToLine1: args.shipToLine1,
        shipToLine2: args.shipToLine2,
        shipToCity: args.shipToCity,
        shipToRegion: args.shipToRegion,
        shipToPostalCode: args.shipToPostalCode,
        shipToCountry: args.shipToCountry,
        clientId: client.id,
        companyId: client.companyId,
        createdByUserId: args.createdByUserId,
        createdByClientUserId: args.createdByClientUserId,
        lines: {
          create: args.lines.map((l) => ({
            skuId: l.skuId,
            quantity: l.quantity,
            clientId: client.id,
            companyId: client.companyId,
          })),
        },
      },
      include: { lines: true },
    });

    // Write personalization values now that line ids exist. Match input
    // lines to created lines by skuId (uniqueness enforced earlier).
    const lineBySkuId = new Map(created.lines.map((l) => [l.skuId, l]));
    for (const lp of linePersonalization) {
      if (lp.toWrite.length === 0) continue;
      const line = lineBySkuId.get(lp.skuId);
      if (!line) continue;
      await tx.orderLinePersonalization.createMany({
        data: lp.toWrite.map((v) => ({
          orderLineItemId: line.id,
          fieldId: v.fieldId,
          fieldKey: v.fieldKey,
          value: v.value,
          clientId: client.id,
          companyId: client.companyId,
        })),
      });
    }

    const result = await runAllocation(tx, created.id);

    if (result.ok) {
      assertTransition(OrderStatus.SUBMITTED, OrderStatus.READY_TO_PICK);
      return tx.order.update({
        where: { id: created.id },
        data: {
          status: OrderStatus.READY_TO_PICK,
          allocatedAt: new Date(),
        },
        include: { lines: { include: { allocations: true } } },
      });
    }

    assertTransition(OrderStatus.SUBMITTED, OrderStatus.AWAITING_STOCK);
    return tx.order.update({
      where: { id: created.id },
      data: { status: OrderStatus.AWAITING_STOCK },
      include: { lines: { include: { allocations: true } } },
    });
  });
}

// Owner-role read across all clients in the company, so generation isn't
// fooled by RLS. We re-derive companyId from the client row instead of
// trusting the caller's TenantContext (defense in depth).
async function peekNextReference(clientId: string): Promise<string> {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { companyId: true },
  });
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `ORD-${yyyymmdd}-`;
  const last = await prisma.order.findFirst({
    where: { companyId: client.companyId, reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  let next = 1;
  if (last) {
    const tail = last.reference.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function isReferenceCollision(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' // unique constraint violation
  );
}
