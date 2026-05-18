import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Box } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { SkusTable } from '@/components/products/skus-table';
import { CreateSkuDialog } from '@/components/products/create-sku-dialog';
import { getProduct, type CreateSkuInput } from '@/features/products';
import { getCurrentStaffContext } from '@/lib/auth';
import { createSkuActionForProduct } from './actions';

export default async function StaffProductDetailPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>;
}) {
  const { id: clientId, productId } = await params;
  const { tenant } = await getCurrentStaffContext();

  const product = await getProduct(tenant, productId);
  if (!product || product.clientId !== clientId) notFound();

  async function action(input: CreateSkuInput) {
    'use server';
    return createSkuActionForProduct(productId, clientId, input);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href={`/warehouse/clients/${clientId}`}
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          Back to client
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          {product.description ? (
            <p className="text-muted-foreground text-sm">{product.description}</p>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">SKUs</h2>
            <p className="text-muted-foreground text-sm">
              Variants under this product. Inventory is tracked per SKU.
            </p>
          </div>
          <CreateSkuDialog action={action} />
        </div>
        {product.skus.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No SKUs yet"
            description="Add the first variant of this product (size, color, style, etc.)."
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
