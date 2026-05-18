import type { SKU } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function SkusTable({ skus }: { skus: SKU[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skus.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-mono text-sm">{s.code}</TableCell>
            <TableCell>{s.name}</TableCell>
            <TableCell className="text-muted-foreground text-right text-sm">
              {s.status.toLowerCase()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
