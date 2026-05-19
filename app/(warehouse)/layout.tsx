import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function WarehouseGroupLayout({ children }: { children: ReactNode }) {
  // Resolve the staff context once at the group level so the shell can
  // render the company name in the brand without each page re-fetching.
  const { company, user } = await getCurrentStaffContext();
  return (
    <AppShell variant="warehouse" brand={company.name} role={user.role}>
      {children}
    </AppShell>
  );
}
