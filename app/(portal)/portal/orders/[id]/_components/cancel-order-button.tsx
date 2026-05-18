'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cancelOrderAction } from '../actions';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
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

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {pending ? 'Cancelling…' : 'Cancel order'}
    </Button>
  );
}
