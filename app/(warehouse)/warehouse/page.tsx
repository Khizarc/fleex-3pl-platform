import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { getCurrentStaffContext } from '@/lib/auth';

export default async function WarehouseHomePage() {
  // Auth is gated by the route-group layout; this call hits React.cache()
  // and reuses the same context to render a personalized heading.
  const { user, company } = await getCurrentStaffContext();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.name.split(' ')[0]}.
        </h1>
        <p className="text-muted-foreground text-sm">
          You&apos;re the {user.role.toLowerCase()} of <strong>{company.name}</strong>.
        </p>
      </div>
      <EmptyState
        icon={LayoutDashboard}
        title="Your warehouse is ready"
        description="Real operational screens — receiving, inventory, orders, pick / pack / ship — land in Phase 1. The next milestone (0.5) adds your first feature: inviting clients."
      />
    </div>
  );
}
