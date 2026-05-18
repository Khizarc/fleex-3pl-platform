import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { StaffCreateOrderForm } from './_components/staff-create-order-form';

export default async function NewStaffOrderPage() {
  const { tenant } = await getCurrentStaffContext();

  // Staff context — RLS shows all clients and all SKUs in this company.
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
      },
    });
  });

  const clientOptions = clientsWithSkus.map((c) => ({
    id: c.id,
    name: c.name,
    skus: c.products.flatMap((p) => p.skus),
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
