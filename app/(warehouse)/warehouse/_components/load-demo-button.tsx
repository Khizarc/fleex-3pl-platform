'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { loadDemoDataAction } from '../actions';

export function LoadDemoButton({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await loadDemoDataAction();
      if (result.ok) {
        toast.success('Demo data loaded — explore the order pipeline');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant={variant}>
      <Sparkles className="size-4" />
      {pending ? 'Loading…' : 'Load demo data'}
    </Button>
  );
}
