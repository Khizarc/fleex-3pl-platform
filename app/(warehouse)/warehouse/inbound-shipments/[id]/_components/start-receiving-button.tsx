'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { startReceivingAction } from '../actions';

export function StartReceivingButton({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const result = await startReceivingAction(shipmentId);
      if (result.ok) {
        toast.success('Receiving started');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={handle} disabled={pending}>
      {pending ? 'Starting…' : 'Start receiving'}
    </Button>
  );
}
