import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CsvImport } from './_components/csv-import';

export default function PortalImportOrdersPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/portal/orders"
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          All orders
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import orders from CSV</h1>
          <p className="text-muted-foreground text-sm">
            Drop a CSV of up to 1000 rows. Rows sharing an{' '}
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

      <CsvImport />
    </div>
  );
}
