import { LayoutDashboard, Package } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <div className="bg-background min-h-screen">
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-24">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">Fleex 3PL Platform</h1>
          <p className="text-muted-foreground text-lg">
            Multi-tenant 3PL warehouse and shipping platform — one backend, two front doors.
          </p>
        </div>

        {userId ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/warehouse"
              className="bg-card hover:bg-accent group rounded-lg border p-6 transition-colors"
            >
              <LayoutDashboard className="text-muted-foreground mb-3 size-6" />
              <h2 className="font-semibold">Warehouse Dashboard</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                3PL staff: receive, pick, pack, ship.
              </p>
            </Link>
            <Link
              href="/portal"
              className="bg-card hover:bg-accent group rounded-lg border p-6 transition-colors"
            >
              <Package className="text-muted-foreground mb-3 size-6" />
              <h2 className="font-semibold">Client Portal</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                The 3PL&apos;s customers: orders, inventory, tracking.
              </p>
            </Link>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
