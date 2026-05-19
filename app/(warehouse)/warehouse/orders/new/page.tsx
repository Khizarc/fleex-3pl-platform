import { PageHeader } from '@/components/page-header';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { StaffCreateOrderForm } from './_components/staff-create-order-form';

export default async function NewStaffOrderPage() {
  const { tenant } = await getCurrentStaffContext();

  // Staff context — RLS shows all clients, SKUs, and personalization
  // definitions in this company. Bundle them per-client so the form can
  // switch dynamically when the staff picks a different client.
  const clientsWithSkus = await withTenantContext(tenant, async (tx) => {
    return tx.client.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        products: {
          select: {
            skus: {
              select: { id: true, code: true, name: true },
              orderBy: { code: 'asc' },
            },
          },
        },
        personalizationFields: {
          where: { status: 'ACTIVE' },
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
          select: { id: true, key: true, label: true, required: true },
        },
      },
    });
  });

  const clientOptions = clientsWithSkus.map((c) => ({
    id: c.id,
    name: c.name,
    skus: c.products.flatMap((p) => p.skus),
    definitions: c.personalizationFields,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New order"
        description="Create an order on behalf of a client — for phone orders or manual fulfillment when the client can't submit themselves."
        backHref="/warehouse/orders"
        backLabel="All orders"
      />

      <StaffCreateOrderForm clients={clientOptions} />
    </div>
  );
}
