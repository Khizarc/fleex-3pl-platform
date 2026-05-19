import { PageHeader } from '@/components/page-header';
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
      <PageHeader
        title="Import orders from CSV"
        description="Pick a client, then drop a CSV of up to 1000 rows. Rows sharing an order_reference become one multi-line order."
        backHref="/warehouse/orders"
        backLabel="All orders"
      />
      <p className="text-muted-foreground text-sm">
        Need the format?{' '}
        <a
          href="/orders-import-template.csv"
          download
          className="underline-offset-4 hover:underline"
        >
          Download template
        </a>
        .
      </p>

      <StaffCsvImport clients={clients} />
    </div>
  );
}
