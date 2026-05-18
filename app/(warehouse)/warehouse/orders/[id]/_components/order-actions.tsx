'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { allocateOrderAction, cancelOrderAction } from '../actions';

export function OrderActions({
  orderId,
  canAllocate,
  canCancel,
}: {
  orderId: string;
  canAllocate: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function runAllocate() {
    startTransition(async () => {
      const result = await allocateOrderAction(orderId);
      if (result.ok) {
        toast.success('Allocation run');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function runCancel() {
    if (!window.confirm('Cancel this order? Any reserved stock will be returned to inventory.')) {
      return;
    }
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (result.ok) {
        toast.success('Order cancelled');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!canAllocate && !canCancel) return null;

  return (
    <div className="flex items-center gap-2">
      {canAllocate ? (
        <Button size="sm" disabled={pending} onClick={runAllocate}>
          {pending ? 'Working…' : 'Try allocation'}
        </Button>
      ) : null}
      {canCancel ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={runCancel}>
          Cancel order
        </Button>
      ) : null}
    </div>
  );
}
