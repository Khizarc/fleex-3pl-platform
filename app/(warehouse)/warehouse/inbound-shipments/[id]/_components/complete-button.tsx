'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { completeAction } from '../actions';

export function CompleteButton({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await completeAction(shipmentId);
      if (result.ok) {
        toast.success('Shipment marked complete');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handle} disabled={pending} variant="default">
      {pending ? 'Completing…' : 'Complete shipment'}
    </Button>
  );
}
