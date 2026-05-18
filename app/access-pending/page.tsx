import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export default function AccessPendingPage() {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4">
      <div className="bg-card w-full max-w-md rounded-lg border p-8 text-center shadow-sm">
        <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Access pending</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          You&apos;re signed in, but haven&apos;t been added to a 3PL portal yet. Contact your 3PL
          administrator to be invited.
        </p>
        <p className="text-muted-foreground mt-4 text-sm">
          If you meant to set up your <em>own</em> 3PL workspace,{' '}
          <Link
            href="/warehouse"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            go to the warehouse dashboard
          </Link>{' '}
          — we&apos;ll set one up for you automatically.
        </p>
        <div className="mt-6">
          <SignOutButton>
            <Button variant="outline" size="sm">
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
