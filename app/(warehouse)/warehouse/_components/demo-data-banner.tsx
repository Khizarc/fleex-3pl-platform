'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { resetDemoDataAction } from '../actions';

export function DemoDataBanner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onReset() {
    const result = await resetDemoDataAction();
    if (result.ok) {
      toast.success('Demo data cleared');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
        <Sparkles className="size-4" />
        <span>
          <strong>Demo data is loaded.</strong> Explore the order pipeline, then reset when
          you&apos;re ready to set up for real.
        </span>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="sm" disabled={pending}>
            <X className="size-3.5" />
            Reset demo
          </Button>
        }
        title="Reset demo data?"
        description="This removes the demo warehouse, client, products, inbound, and orders. Anything you've created on top stays."
        confirmLabel="Reset demo"
        cancelLabel="Keep it"
        tone="danger"
        onConfirm={() => {
          return new Promise<void>((resolve) => {
            startTransition(async () => {
              await onReset();
              resolve();
            });
          });
        }}
      />
    </div>
  );
}
