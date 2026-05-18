import Link from 'next/link';
import type { Client } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ClientsTable({ clients }: { clients: Client[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">
              <Link
                href={`/warehouse/clients/${c.id}`}
                className="underline-offset-4 hover:underline"
              >
                {c.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {c.status.toLowerCase()}
            </TableCell>
            <TableCell className="text-muted-foreground text-right text-sm">
              {c.createdAt.toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
