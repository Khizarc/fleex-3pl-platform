// `withTenantContext` — the only sanctioned way to query tenant-scoped data.
//
// Opens a Prisma transaction, switches role from owner to `app_user`
// (so RLS policies apply), and sets the two tenant session variables read by
// the policies (see prisma/migrations/.../migration.sql). The transactional
// client is passed to the callback; all queries through it run under that
// tenant context.

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { TenantContext } from '@/lib/tenancy';

type TransactionClient = Prisma.TransactionClient;

export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // `SET LOCAL ROLE` lasts the transaction's lifetime — compatible with
    // pgBouncer transaction mode (Neon's default for the pooled URL).
    await tx.$executeRawUnsafe('SET LOCAL ROLE app_user');

    // `true` (third arg) makes set_config transaction-local.
    //
    // Both session vars are ALWAYS set — even when clientId is undefined we
    // write ''. Otherwise current_setting('app.current_client_id', true) would
    // return NULL (not ''), the `... = ''` arm of the Client/ClientUser policy
    // would short-circuit to NULL → FALSE, and staff-context queries (no
    // clientId) would see zero rows. The empty string is the documented
    // "no client context" sentinel; the migration's policy expects it.
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${ctx.companyId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_client_id', ${ctx.clientId ?? ''}, true)`;

    return fn(tx);
  });
}
