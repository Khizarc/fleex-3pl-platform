import { UserButton } from '@clerk/nextjs';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function WarehouseHomePage() {
  const { user, company } = await getCurrentStaffContext();
  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Warehouse Dashboard</h1>
        <UserButton />
      </header>
      <p>
        Welcome, <strong>{user.name}</strong> — {user.role.toLowerCase()} of{' '}
        <strong>{company.name}</strong>.
      </p>
      <p>Real screens land in Phase 1.</p>
    </main>
  );
}
