import Link from 'next/link';
import { Role } from '@prisma/client';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Package,
  Plus,
  Send,
  ShoppingBag,
  Truck,
  Warehouse,
} from 'lucide-react';
import { OnboardingChecklist, type OnboardingStep } from '@/components/onboarding/checklist';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getStaffDashboard } from '@/features/dashboards';
import { getOnboardingProgress, hasDemoData } from '@/features/onboarding';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { DemoDataBanner } from './_components/demo-data-banner';
import { LoadDemoButton } from './_components/load-demo-button';
import { RoleLanding } from './_components/role-landing';
import { WelcomeDialog } from './_components/welcome-dialog';

const ROLE_TO_STATUS = {
  RECEIVER: ['NOTIFIED', 'RECEIVING'] as const,
  PICKER: 'READY_TO_PICK' as const,
  PACKER: 'PICKED' as const,
  SHIPPER: 'PACKED' as const,
};

export default async function WarehouseHomePage() {
  const { user, tenant, company } = await getCurrentStaffContext();

  // Non-ADMIN staff see a focused role-specific landing rather than the
  // company-level dashboard. They care about their queue, not KPIs.
  if (user.role !== Role.ADMIN) {
    const role = user.role as 'RECEIVER' | 'PICKER' | 'PACKER' | 'SHIPPER';
    const count = await withTenantContext(tenant, async (tx) => {
      if (role === 'RECEIVER') {
        return tx.inboundShipment.count({
          where: {
            status: { in: ROLE_TO_STATUS.RECEIVER as unknown as ('NOTIFIED' | 'RECEIVING')[] },
          },
        });
      }
      return tx.order.count({ where: { status: ROLE_TO_STATUS[role] } });
    });
    return (
      <RoleLanding
        role={role}
        firstName={user.name.split(' ')[0] ?? user.name}
        queueCount={count}
      />
    );
  }

  const [progress, dashboard, demoLoaded] = await Promise.all([
    getOnboardingProgress(tenant),
    getStaffDashboard(tenant),
    hasDemoData(tenant),
  ]);

  const steps: OnboardingStep[] = [
    {
      key: 'warehouse',
      label: 'Create a warehouse',
      description: 'Add your first warehouse with aisles, zones, and bins.',
      href: '/warehouse/warehouses',
      done: progress.warehouseCreated,
    },
    {
      key: 'client',
      label: 'Add a client',
      description: 'The brand whose goods you store and ship.',
      href: '/warehouse/clients',
      done: progress.clientCreated,
    },
    {
      key: 'sku',
      label: 'Add a product and SKU',
      description: 'Each product needs at least one SKU variant to track stock.',
      href: '/warehouse/clients',
      done: progress.skuCreated,
    },
    {
      key: 'clientUser',
      label: 'Invite a client portal user',
      description: 'Give the client a login so they can submit orders themselves.',
      href: '/warehouse/clients',
      done: progress.clientUserInvited,
    },
    {
      key: 'inbound',
      label: 'Receive your first inbound shipment',
      description: 'Clients notify of incoming stock; staff receives it into bins.',
      href: '/warehouse/inbound-shipments',
      done: progress.inboundReceived,
    },
  ];

  const isFreshCompany = !steps.some((s) => s.done);

  return (
    <div className="space-y-6">
      <WelcomeDialog firstName={user.name.split(' ')[0] ?? user.name} companyName={company.name} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.name.split(' ')[0]}.
        </h1>
        <p className="text-muted-foreground text-sm">
          Here&apos;s what&apos;s happening across your warehouse today.
        </p>
      </div>

      {demoLoaded ? <DemoDataBanner /> : null}

      {isFreshCompany && !demoLoaded ? (
        <Card className="bg-muted/30">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">Want to explore the product first?</p>
              <p className="text-muted-foreground text-sm">
                Load a fully populated demo workspace so you can try every workflow without setting
                up.
              </p>
            </div>
            <LoadDemoButton />
          </div>
        </Card>
      ) : null}

      <OnboardingChecklist steps={steps} />

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/warehouse/orders/new"
            icon={Plus}
            label="Create order"
            hint="Phone or manual order on behalf of a client."
          />
          <QuickAction
            href="/warehouse/inbound-shipments"
            icon={Truck}
            label="Receive shipment"
            hint="Check in stock from an inbound shipment."
          />
          <QuickAction
            href="/warehouse/clients"
            icon={Boxes}
            label="Manage clients"
            hint="Products, SKUs, personalization, and portal users."
          />
          <QuickAction
            href="/warehouse/warehouses"
            icon={Warehouse}
            label="Manage warehouses"
            hint="Zones, aisles, and bins."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          At a glance
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={ShoppingBag}
            label="Active orders"
            value={dashboard.kpis.activeOrders}
            hint="Submitted through packed"
            href="/warehouse/orders"
          />
          <StatCard
            icon={Truck}
            label="Pending receive"
            value={dashboard.kpis.pendingReceive}
            hint="Notified or in receiving"
            href="/warehouse/inbound-shipments"
          />
          <StatCard
            icon={ClipboardCheck}
            label="Ready to pick"
            value={dashboard.kpis.readyToPick}
            hint="Allocated and queued"
            href="/warehouse/pick"
          />
          <StatCard
            icon={Send}
            label="Ready to ship"
            value={dashboard.kpis.readyToShip}
            hint="Packed and waiting on label"
            href="/warehouse/ship"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Needs attention
          </h2>
          <Card>
            {dashboard.needsAttention.length === 0 ? (
              <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
                <Boxes className="size-4" />
                Nothing needs attention right now.
              </div>
            ) : (
              <ul className="divide-y">
                {dashboard.needsAttention.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/warehouse/orders/${row.id}`}
                      className="hover:bg-accent/40 flex items-center justify-between gap-3 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium">{row.clientName}</p>
                          <p className="text-muted-foreground text-xs">
                            Submitted {new Date(row.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <OrderStatusBadge status={row.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            Today&apos;s activity
          </h2>
          <Card>
            <div className="grid grid-cols-3 divide-x">
              <div className="p-4 text-center">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Picked
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {dashboard.todayActivity.picked}
                </p>
              </div>
              <div className="p-4 text-center">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Packed
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {dashboard.todayActivity.packed}
                </p>
              </div>
              <div className="p-4 text-center">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Shipped
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {dashboard.todayActivity.shipped}
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>

      <p className="text-muted-foreground text-xs">
        <Package className="mr-1 inline size-3" />
        Need a refresher? Open the sidebar to jump to any operation.
      </p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start gap-3 p-4 text-left">
      <Link href={href}>
        <Icon className="size-4 shrink-0" />
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground text-xs font-normal">{hint}</span>
        </span>
      </Link>
    </Button>
  );
}
