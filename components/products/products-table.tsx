import Link from 'next/link';
import type { Product } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Presentational. `productHref(product)` lets the parent control the link
// target — staff routes link to /warehouse/clients/[id]/products/[productId],
// portal routes link to /portal/products/[productId].
export function ProductsTable({
  products,
  productHref,
}: {
  products: Product[];
  productHref: (product: Product) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">
              <Link href={productHref(p)} className="underline-offset-4 hover:underline">
                {p.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">{p.description ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground text-right text-sm">
              {p.createdAt.toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
