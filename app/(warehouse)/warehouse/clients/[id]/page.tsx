import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package, Sparkles, UserPlus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { ProductsTable } from '@/components/products/products-table';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listProducts } from '@/features/products';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import type { CreateProductInput } from '@/features/products';
import type { InviteClientUserInput } from '@/features/clients';
import { createProductActionForClient, inviteClientUserAction } from './actions';
import { InviteClientUserDialog } from './_components/invite-client-user-dialog';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await getCurrentStaffContext();

  // Verify the client exists in this tenant (RLS-filtered) and grab its name.
  // Also load existing portal users so the admin can see who has access.
  const client = await withTenantContext(tenant, async (tx) => {
    const c = await tx.client.findUnique({
      where: { id },
      include: {
        clientUsers: {
          select: {
            id: true,
            email: true,
            name: true,
            authProviderId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return c;
  });
  if (!client) notFound();

  const products = await listProducts(tenant, { clientId: client.id });

  // Both actions need a captured clientId; declare them as `'use server'` so
  // they cross the server→client boundary cleanly.
  async function productAction(input: CreateProductInput) {
    'use server';
    return createProductActionForClient(client!.id, input);
  }
  async function inviteAction(input: InviteClientUserInput) {
    'use server';
    return inviteClientUserAction(client!.id, input);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        description="Manage this client's products, SKUs, personalization, and portal access."
        backHref="/warehouse/clients"
        backLabel="All clients"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/warehouse/clients/${client.id}/personalization`}>
              <Sparkles className="size-4" />
              Personalization
            </Link>
          </Button>
        }
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Portal users</h2>
            <p className="text-muted-foreground text-sm">
              People at {client.name} who can sign into the portal to submit orders.
            </p>
          </div>
          <InviteClientUserDialog clientName={client.name} action={inviteAction} />
        </div>
        <Card>
          {client.clientUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <UserPlus className="text-muted-foreground size-6" />
              <p className="text-sm font-medium">No portal users yet</p>
              <p className="text-muted-foreground max-w-sm text-xs">
                Invite someone at {client.name} so they can submit orders themselves instead of you
                doing it for them.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {client.clientUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                  </div>
                  {u.authProviderId === null ? (
                    <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">
                      Pending sign-up
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Products</h2>
            <p className="text-muted-foreground text-sm">
              The catalog of goods you store and ship for {client.name}.
            </p>
          </div>
          <CreateProductDialog
            action={productAction}
            onCreatedBasePath={`/warehouse/clients/${client.id}/products`}
          />
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description={`Add ${client.name}'s first product. You'll add SKU variants after.`}
            action={<CreateProductDialog action={productAction} />}
          />
        ) : (
          <div className="rounded-lg border">
            <ProductsTable
              products={products}
              productHref={(p) => `/warehouse/clients/${client.id}/products/${p.id}`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
