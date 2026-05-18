import { UserButton } from '@clerk/nextjs';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalHomePage() {
  const { clientUser, client, company } = await getCurrentClientContext();
  const brandedAs = company.brandName ?? company.name;
  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{brandedAs} Portal</h1>
        <UserButton />
      </header>
      <p>
        Welcome, <strong>{clientUser.name}</strong> — viewing <strong>{client.name}</strong>&apos;s
        portal at <strong>{brandedAs}</strong>.
      </p>
      <p>White-labeling lands in Phase 5.</p>
    </main>
  );
}
