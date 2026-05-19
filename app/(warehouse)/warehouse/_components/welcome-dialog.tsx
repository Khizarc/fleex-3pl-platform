'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { loadDemoDataAction } from '../actions';

const STORAGE_KEY = 'fleex.welcome-dismissed';

export function WelcomeDialog({
  firstName,
  companyName,
}: {
  firstName: string;
  companyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY) !== 'true') {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(false);
  }

  function onLoadDemo() {
    startTransition(async () => {
      const result = await loadDemoDataAction();
      if (result.ok) {
        toast.success('Demo data loaded — explore the order pipeline');
        dismiss();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome to Fleex, {firstName}.</DialogTitle>
          <DialogDescription>
            You&apos;re the admin of <strong>{companyName}</strong>. How would you like to start?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <button
            onClick={onLoadDemo}
            disabled={pending}
            className="hover:bg-accent/40 rounded-lg border p-4 text-left transition-colors disabled:opacity-60"
          >
            <Sparkles className="text-muted-foreground mb-2 size-5" />
            <p className="font-medium">Load demo data</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Populate a sample warehouse, client, products, inbound, and order so you can try every
              workflow without setting up first.
            </p>
          </button>
          <button
            onClick={dismiss}
            className="hover:bg-accent/40 rounded-lg border p-4 text-left transition-colors"
          >
            <Wrench className="text-muted-foreground mb-2 size-5" />
            <p className="font-medium">Set up manually</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Walk the 5-step onboarding checklist on the dashboard — create your first warehouse,
              client, product, and inbound.
            </p>
          </button>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={pending}>
            I&apos;ll decide later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
