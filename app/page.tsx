import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  Send,
  Sparkles,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { auth } from '@clerk/nextjs/server';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <div className="bg-background min-h-screen">
      {/* Top nav */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <Warehouse className="size-5" />
            Fleex
          </div>
          <nav className="flex items-center gap-2">
            {userId ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/warehouse">Warehouse</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/portal">Portal</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="bg-muted text-muted-foreground mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3" />
            Multi-tenant 3PL platform
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            3PL warehouse management,
            <br />
            without the spreadsheet.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg">
            Receive inventory, store it in real bins, fulfill orders with personalization, and ship
            with any carrier — all from one workspace your clients can log into too.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {userId ? (
              <>
                <Button asChild size="lg">
                  <Link href="/warehouse">
                    Open warehouse dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/portal">Open client portal</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/sign-up">
                    Get started — it&apos;s free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-10 text-center">
            <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Receive → Store → Ship
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <HowItWorksCard
              n={1}
              icon={Truck}
              title="Receive"
              description="Clients notify you of incoming inventory from their portal. Staff check it into bins with scan-to-confirm."
            />
            <HowItWorksCard
              n={2}
              icon={Boxes}
              title="Store"
              description="Real-time inventory across warehouses, aisles, and bins. Stock is reserved when orders submit."
            />
            <HowItWorksCard
              n={3}
              icon={Send}
              title="Ship"
              description="Pick by bin, pack with dimensions and personalization, ship with any carrier — tracking surfaces automatically."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-10 text-center">
            <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              What&apos;s built in
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything a small 3PL actually needs.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={Users}
              title="Multi-tenant clients"
              description="Every brand gets their own portal — orders, inventory, products — fully isolated by database-level RLS."
            />
            <FeatureCard
              icon={Sparkles}
              title="Personalization"
              description="Per-line custom fields like engraving text or monogram, captured at order and visible at pack."
            />
            <FeatureCard
              icon={ClipboardCheck}
              title="Pick / Pack / Ship"
              description="Three workflows with role gates, queue-driven, every action audit-logged with the staff member who did it."
            />
            <FeatureCard
              icon={Package}
              title="Real-time inventory"
              description="Stock levels update on receive, allocate, and pick. Materialized per bin so picking is one trip."
            />
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <LayoutDashboard className="text-muted-foreground mx-auto mb-4 size-8" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to see it in action?
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-base">
            Sign up takes 30 seconds. You can load demo data on your first login to explore a fully
            populated warehouse before you set up your own.
          </p>
          <div className="mt-7">
            {userId ? (
              <Button asChild size="lg">
                <Link href="/warehouse">Open dashboard</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto max-w-6xl px-6 py-6 text-center text-xs">
          Fleex — multi-tenant 3PL warehouse and shipping platform.
        </div>
      </footer>
    </div>
  );
}

function HowItWorksCard({
  n,
  icon: Icon,
  title,
  description,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="relative p-6">
      <div className="bg-muted text-muted-foreground absolute top-4 right-4 flex size-6 items-center justify-center rounded-full text-xs font-semibold">
        {n}
      </div>
      <Icon className="text-muted-foreground mb-4 size-6" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </Card>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-5">
      <Icon className="text-muted-foreground mb-3 size-5" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-xs">{description}</p>
    </Card>
  );
}
