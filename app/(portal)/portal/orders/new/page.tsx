import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getCurrentClientContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { CreateOrderForm } from './_components/create-order-form';

export default async function NewOrderPage() {
  const { tenant } = await getCurrentClientContext();

  // RLS scopes to the caller's own client — only their SKUs surface.
  const skus = await withTenantContext(tenant, async (tx) =>
    tx.sKU.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/portal/orders"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All orders
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New order</h1>
          <p className="text-muted-foreground text-sm">
            Tell your 3PL where to ship, what to ship, and how much.
          </p>
        </div>
      </div>

      <CreateOrderForm skus={skus} />
    </div>
  );
}
