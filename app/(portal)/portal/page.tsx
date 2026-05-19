import Link from 'next/link';
import { ArrowRight, Boxes, Clock, Package, ShoppingBag, Sparkles, Truck } from 'lucide-react';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPortalDashboard } from '@/features/dashboards';
import { getCurrentClientContext } from '@/lib/auth';

export default async function PortalHomePage() {
  const { clientUser, client, company, tenant } = await getCurrentClientContext();
  const brand = company.brandName ?? company.name;
  const dashboard = await getPortalDashboard(tenant);

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

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          At a glance
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={ShoppingBag}
            label="In-flight orders"
            value={dashboard.kpis.inFlightOrders}
            hint="Submitted through packed"
            href="/portal/orders"
          />
          <StatCard
            icon={Package}
            label="Total SKUs"
            value={dashboard.kpis.totalSkus}
            hint="Across all products"
            href="/portal/products"
          />
          <StatCard
            icon={Truck}
            label="Pending inbounds"
            value={dashboard.kpis.pendingInbounds}
            hint="Notified or being received"
            href="/portal/inbound-shipments"
          />
          <StatCard
            icon={Clock}
            label="Awaiting stock"
            value={dashboard.kpis.awaitingStock}
            hint="Orders waiting on inventory"
            tone={dashboard.kpis.awaitingStock > 0 ? 'attention' : 'default'}
            href="/portal/orders"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Recent orders
            </h2>
            <Link
              href="/portal/orders"
              className="text-muted-foreground inline-flex items-center text-xs hover:underline"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <Card>
            {dashboard.recentOrders.length === 0 ? (
              <div className="text-muted-foreground p-4 text-sm">
                No orders yet. Submit your first one to get started.
              </div>
            ) : (
              <ul className="divide-y">
                {dashboard.recentOrders.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/portal/orders/${row.id}`}
                      className="hover:bg-accent/40 flex items-center justify-between gap-3 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Submitted {new Date(row.submittedAt).toLocaleDateString()}
                        </p>
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
            Quick actions
          </h2>
          <div className="space-y-2">
            <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 p-4">
              <Link href="/portal/orders/new">
                <ShoppingBag className="size-4" />
                <div className="text-left">
                  <p className="font-medium">Submit an order</p>
                  <p className="text-muted-foreground text-xs">
                    Ship-to address, lines, and personalization values.
                  </p>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 p-4">
              <Link href="/portal/inbound-shipments/new">
                <Truck className="size-4" />
                <div className="text-left">
                  <p className="font-medium">Notify of incoming stock</p>
                  <p className="text-muted-foreground text-xs">
                    Let the warehouse know what&apos;s arriving and when.
                  </p>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 p-4">
              <Link href="/portal/inventory">
                <Boxes className="size-4" />
                <div className="text-left">
                  <p className="font-medium">Check inventory</p>
                  <p className="text-muted-foreground text-xs">Real-time levels across all bins.</p>
                </div>
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <p className="text-muted-foreground text-xs">
        <Sparkles className="mr-1 inline size-3" />
        Need a personalization field added to your orders? Ask your warehouse admin.
      </p>
    </div>
  );
}
