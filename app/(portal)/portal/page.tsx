import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalHomePage() {
  const { clientUser, client, company } = await getCurrentClientContext();
  const brand = company.brandName ?? company.name;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {clientUser.name.split(' ')[0]}.
        </h1>
        <p className="text-muted-foreground text-sm">
          Viewing <strong>{client.name}</strong>&apos;s portal at <strong>{brand}</strong>.
        </p>
      </div>
      <EmptyState
        icon={LayoutDashboard}
        title="Your portal is set up"
        description="Inventory, orders, and tracking land in Phase 1. White-labeled branding is Phase 5."
      />
    </div>
  );
}
