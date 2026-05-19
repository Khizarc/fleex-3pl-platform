import { PageHeader } from '@/components/page-header';
import { CsvImport } from './_components/csv-import';

export default function PortalImportOrdersPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Import orders from CSV"
        description="Drop a CSV of up to 1000 rows. Rows sharing an order_reference become one multi-line order."
        backHref="/portal/orders"
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

      <CsvImport />
    </div>
  );
}
