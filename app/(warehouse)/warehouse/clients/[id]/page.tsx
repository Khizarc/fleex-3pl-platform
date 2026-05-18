import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ProductsTable } from '@/components/products/products-table';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
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
      <div className="space-y-2">
        <Link
          href="/warehouse/clients"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All clients
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground text-sm">A client of your 3PL.</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Products</h2>
            <p className="text-muted-foreground text-sm">
              The catalog of goods you store and ship for {client.name}.
            </p>
          </div>
          <CreateProductDialog action={action} />
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description={`Add ${client.name}'s first product. You'll add SKU variants after.`}
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
