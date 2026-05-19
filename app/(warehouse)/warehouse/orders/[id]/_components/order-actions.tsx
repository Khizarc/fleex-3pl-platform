'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
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

  async function runCancel() {
    const result = await cancelOrderAction(orderId);
    if (result.ok) {
      toast.success('Order cancelled');
      router.refresh();
    } else {
      toast.error(result.error);
    }
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
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              Cancel order
            </Button>
          }
          title="Cancel this order?"
          description="Any reserved stock will be returned to inventory. This cannot be undone."
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          tone="danger"
          onConfirm={runCancel}
        />
      ) : null}
    </div>
  );
}
