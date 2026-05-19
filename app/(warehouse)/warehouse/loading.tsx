import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Skeleton mirrors the actual dashboard shape so the swap-in feels seamless.
// PageHeader + KPI strip + section + table.
export default function WarehouseLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="size-7 rounded-md" />
            </div>
            <Skeleton className="mt-2 h-9 w-12" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
