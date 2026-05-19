import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalGroupLayout({ children }: { children: ReactNode }) {
  // Resolve the client portal context once at the group level so the shell
  // can render the 3PL's white-label brand (falling back to the legal name).
  const { company, client } = await getCurrentClientContext();
  const brand = company.brandName ?? company.name;
  return (
    <AppShell variant="portal" brand={brand} role={client.name}>
      {children}
    </AppShell>
  );
}
