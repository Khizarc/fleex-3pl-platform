import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getCurrentStaffContext } from '@/lib/auth';
import { withTenantContext } from '@/lib/db';
import { StaffCsvImport } from './_components/staff-csv-import';

export default async function WarehouseImportOrdersPage() {
  const { tenant } = await getCurrentStaffContext();

  const clients = await withTenantContext(tenant, async (tx) =>
    tx.client.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/warehouse/orders"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All orders
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import orders from CSV</h1>
          <p className="text-muted-foreground text-sm">
            Pick a client first, then drop a CSV of up to 1000 rows. Rows sharing an{' '}
            <code className="bg-muted rounded px-1 text-xs">order_reference</code> become one
            multi-line order. Need the format?{' '}
            <a
              href="/orders-import-template.csv"
              download
              className="underline-offset-4 hover:underline"
            >
              Download template
            </a>
            .
          </p>
        </div>
      </div>

      <StaffCsvImport clients={clients} />
    </div>
  );
}
