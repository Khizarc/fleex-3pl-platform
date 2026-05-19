import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { ProductsTable } from '@/components/products/products-table';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
import { Button } from '@/components/ui/button';
import { listProducts } from '@/features/products';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import type { CreateProductInput } from '@/features/products';
import { createProductActionForClient } from './actions';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await getCurrentStaffContext();

  // Verify the client exists in this tenant (RLS-filtered) and grab its name.
  const client = await withTenantContext(tenant, async (tx) =>
    tx.client.findUnique({ where: { id } }),
  );
  if (!client) notFound();

  const products = await listProducts(tenant, { clientId: client.id });

  // Bind the clientId once so the dialog can submit the simpler input shape.
  async function action(input: CreateProductInput) {
    'use server';
    return createProductActionForClient(client!.id, input);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        description="Manage this client's products, SKUs, and personalization fields."
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
            <h2 className="text-lg font-semibold">Products</h2>
            <p className="text-muted-foreground text-sm">
              The catalog of goods you store and ship for {client.name}.
            </p>
          </div>
          <CreateProductDialog
            action={action}
            onCreatedHref={(productId) => `/warehouse/clients/${client!.id}/products/${productId}`}
          />
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description={`Add ${client.name}'s first product. You'll add SKU variants after.`}
            action={<CreateProductDialog action={action} />}
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
