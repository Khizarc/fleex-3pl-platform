import { notFound } from 'next/navigation';
import { Box } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { SkusTable } from '@/components/products/skus-table';
import { CreateSkuDialog } from '@/components/products/create-sku-dialog';
import { getProduct, type CreateSkuInput } from '@/features/products';
import { getCurrentClientContext } from '@/lib/auth';
import { createSkuActionForPortal } from './actions';

export default async function PortalProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { tenant } = await getCurrentClientContext();

  // RLS filters the product — if it belongs to another client, this returns
  // null and we render a 404.
  const product = await getProduct(tenant, productId);
  if (!product) notFound();

  async function action(input: CreateSkuInput) {
    'use server';
    return createSkuActionForPortal(productId, input);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={product.name}
        description={
          product.description ?? 'Add SKU variants to track inventory under this product.'
        }
        backHref="/portal/products"
        backLabel="All products"
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">SKUs</h2>
            <p className="text-muted-foreground text-sm">
              Variants under this product (size, color, etc.).
            </p>
          </div>
          <CreateSkuDialog action={action} />
        </div>
        {product.skus.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No SKUs yet"
            description="Add the first variant of this product."
            action={<CreateSkuDialog action={action} />}
          />
        ) : (
          <div className="rounded-lg border">
            <SkusTable skus={product.skus} />
          </div>
        )}
      </section>
    </div>
  );
}
