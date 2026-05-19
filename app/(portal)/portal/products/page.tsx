import { Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
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
      <PageHeader
        title="Products"
        description={`${client.name}'s product catalog. Add SKU variants under each product to track inventory.`}
        action={
          <CreateProductDialog action={createProductAction} onCreatedBasePath="/portal/products" />
        }
        helpKey="portal.products"
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first product to start defining your catalog. SKUs come next."
          action={
            <CreateProductDialog
              action={createProductAction}
              onCreatedBasePath="/portal/products"
            />
          }
        />
      ) : (
        <div className="rounded-lg border">
          <ProductsTable products={products} productHref={(p) => `/portal/products/${p.id}`} />
        </div>
      )}
    </div>
  );
}
