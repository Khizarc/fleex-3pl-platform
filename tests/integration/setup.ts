// Helpers shared across integration tests that touch the database.
//
// These run as the schema owner (neondb_owner on Neon, postgres in CI),
// which bypasses RLS — appropriate for fixture setup and teardown.

import { prisma } from '@/lib/db/prisma';

export function assertDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. For local: copy .env.example to .env.local and fill in Neon URLs.',
    );
  }
}

// TRUNCATE bypasses RLS policies; CASCADE handles the FK chain
// (Company → Client → ClientUser, Company → User).
export async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ClientUser", "Client", "User", "Company" RESTART IDENTITY CASCADE',
  );
}
