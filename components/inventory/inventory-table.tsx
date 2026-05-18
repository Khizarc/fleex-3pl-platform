import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { InventoryRow } from '@/features/inventory';

export function InventoryTable({
  rows,
  showClient,
}: {
  rows: InventoryRow[];
  showClient: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Product</TableHead>
          {showClient ? <TableHead>Client</TableHead> : null}
          <TableHead className="text-right">Available</TableHead>
          <TableHead className="text-right">Reserved</TableHead>
          <TableHead className="text-right">On hold</TableHead>
          <TableHead className="text-right">Damaged</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.skuId}>
            <TableCell className="font-mono text-sm">{r.skuCode}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              <div>{r.skuName}</div>
              <div className="text-xs opacity-70">{r.productName}</div>
            </TableCell>
            {showClient ? (
              <TableCell className="text-muted-foreground text-sm">{r.clientName}</TableCell>
            ) : null}
            <TableCell className="text-right tabular-nums">{r.available}</TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {r.reserved}
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {r.onHold}
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {r.damaged}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">{r.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
