'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CsvImport } from '@/components/orders/csv-import';
import {
  importOrdersAction,
  resolvePersonalizationFieldsAction,
  resolveSkusAction,
} from '../actions';

type ClientOption = { id: string; name: string };

export function StaffCsvImport({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState<string>('');

  const hasClient = !!clientId;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Importing on behalf of</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Pick a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasClient ? (
        <CsvImport
          key={clientId}
          resolveSkus={(codes) => resolveSkusAction(clientId, codes)}
          resolveFields={() => resolvePersonalizationFieldsAction(clientId)}
          importOrders={(orders) => importOrdersAction(clientId, orders)}
          detailHrefPrefix="/warehouse/orders"
        />
      ) : (
        <div className="bg-muted/30 text-muted-foreground rounded-md border p-6 text-sm">
          Pick a client above to continue.
        </div>
      )}
    </div>
  );
}
