'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cancelOrderAction } from '../actions';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();

  async function onConfirm() {
    const result = await cancelOrderAction(orderId);
    if (result.ok) {
      toast.success('Order cancelled');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
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
      onConfirm={onConfirm}
    />
  );
}
