import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Product } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Each row is a stretched link — clicking anywhere drills into the product.
// Optional `_count.skus` surfaces SKU count next to the name so admins see
// which products still need variants without drilling in.
export type ProductListItem = Product & {
  _count?: { skus: number };
};

export function ProductsTable({
  products,
  productHref,
}: {
  products: ProductListItem[];
  productHref: (product: ProductListItem) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>SKUs</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow
            key={p.id}
            className="hover:bg-accent/40 group relative cursor-pointer transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={productHref(p)}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {p.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">{p._count?.skus ?? 0}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{p.description ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground text-right text-sm">
              {p.createdAt.toLocaleDateString()}
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
