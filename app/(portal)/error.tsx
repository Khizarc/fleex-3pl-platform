'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {error.message ||
            'An unexpected error happened. Try the page again — if it keeps failing, contact your 3PL.'}
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-1 font-mono text-xs">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/portal">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
