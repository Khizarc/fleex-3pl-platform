import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
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
      <div className="space-y-2">
        <Link
          href="/warehouse/orders"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All orders
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New order</h1>
          <p className="text-muted-foreground text-sm">
            Create an order on behalf of a client (phone order, manual fulfillment).
          </p>
        </div>
      </div>

      <StaffCreateOrderForm clients={clientOptions} />
    </div>
  );
}
