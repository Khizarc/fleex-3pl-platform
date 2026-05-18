// Singleton Prisma client. Connects as the schema owner (neondb_owner on Neon,
// postgres in CI) — which bypasses RLS naturally.
//
// USE THIS ONLY FOR: migrations, seeds, and test fixture setup.
//
// Application code MUST go through `withTenantContext` instead (see
// `./tenant-context.ts`). That wrapper opens a transaction, switches role to
// `app_user`, and sets the tenant session variables so RLS policies enforce
// isolation. Bypassing it leaks cross-tenant data — the exact failure mode
// CLAUDE.md forbids.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Reuse across Next.js hot-reloads in dev so we don't exhaust the connection pool.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
