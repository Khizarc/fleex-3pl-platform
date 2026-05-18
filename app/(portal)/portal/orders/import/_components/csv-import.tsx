'use client';

import { CsvImport as SharedCsvImport } from '@/components/orders/csv-import';
import { importOrdersAction, resolveSkusAction } from '../actions';

export function CsvImport() {
  return (
    <SharedCsvImport
      resolveSkus={(codes) => resolveSkusAction(codes)}
      importOrders={(orders) => importOrdersAction(orders)}
      detailHrefPrefix="/portal/orders"
    />
  );
}
