import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ProductsTable } from '@/components/products/products-table';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
import { listProducts } from '@/features/products';
import { getCurrentClientContext } from '@/lib/auth';
import { createProductAction } from './actions';

export default async function PortalProductsPage() {
  const { tenant, client } = await getCurrentClientContext();
  // RLS handles the client filter here automatically because tenant.clientId
  // is set in the portal context.
  const products = await listProducts(tenant);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            {client.name}&apos;s product catalog. Add SKU variants under each product.
          </p>
        </div>
        <CreateProductDialog action={createProductAction} />
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first product to start defining your catalog."
        />
      ) : (
        <div className="rounded-lg border">
          <ProductsTable products={products} productHref={(p) => `/portal/products/${p.id}`} />
        </div>
      )}
    </div>
  );
}
