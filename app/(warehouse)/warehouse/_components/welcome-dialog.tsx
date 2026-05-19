'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
            className="hover:bg-accent/40 hover:border-foreground/15 cursor-pointer rounded-lg border p-4 text-left transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-md disabled:opacity-60"
          >
            <Sparkles className="text-muted-foreground mb-2 size-5" />
            <p className="font-medium">Load demo data</p>
            <p className="text-muted-foreground mt-1 text-xs">
              A populated workspace to try every workflow.
            </p>
          </button>
          <button
            onClick={dismiss}
            className="hover:bg-accent/40 hover:border-foreground/15 cursor-pointer rounded-lg border p-4 text-left transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-md"
          >
            <Wrench className="text-muted-foreground mb-2 size-5" />
            <p className="font-medium">Set up manually</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Walk the 5-step checklist on the dashboard.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
