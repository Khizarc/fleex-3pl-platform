import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Client } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Each row is a stretched link — the Link's `::after` pseudo-element covers
// the entire row, so clicking anywhere drills in. Hover state + right
// chevron make the affordance obvious even before you hover.
export type ClientListRow = Client & {
  _count?: { products: number; clientUsers: number };
};

export function ClientsTable({ clients }: { clients: ClientListRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Products</TableHead>
          <TableHead>Portal users</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow
            key={c.id}
            className="hover:bg-accent/40 group relative cursor-pointer transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={`/warehouse/clients/${c.id}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {c.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {c._count?.products ?? 0}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {c._count?.clientUsers ?? 0}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {c.status.toLowerCase()}
            </TableCell>
            <TableCell className="text-muted-foreground text-right text-sm">
              {c.createdAt.toLocaleDateString()}
            </TableCell>
            <TableCell className="w-8">
              <ChevronRight className="text-muted-foreground size-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
