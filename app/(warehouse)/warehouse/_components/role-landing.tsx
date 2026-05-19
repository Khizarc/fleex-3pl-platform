import Link from 'next/link';
import { ArrowRight, ClipboardCheck, Package, Send, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RoleLandingProps {
  role: 'RECEIVER' | 'PICKER' | 'PACKER' | 'SHIPPER';
  firstName: string;
  queueCount: number;
}

// Sub-roles see a focused "what to do today" view instead of the admin
// dashboard. The big card matches the queue they care about; secondary stats
// orient them on the rest of the pipeline.
export function RoleLanding({ role, firstName, queueCount }: RoleLandingProps) {
  const META: Record<
    RoleLandingProps['role'],
    { icon: LucideIcon; label: string; queueHref: string; queueLabel: string; verb: string }
  > = {
    RECEIVER: {
      icon: Truck,
      label: 'Receiver',
      queueHref: '/warehouse/inbound-shipments',
      queueLabel: 'Inbound to receive',
      verb: 'check in',
    },
    PICKER: {
      icon: ClipboardCheck,
      label: 'Picker',
      queueHref: '/warehouse/pick',
      queueLabel: 'Orders to pick',
      verb: 'pick',
    },
    PACKER: {
      icon: Package,
      label: 'Packer',
      queueHref: '/warehouse/pack',
      queueLabel: 'Orders to pack',
      verb: 'pack',
    },
    SHIPPER: {
      icon: Send,
      label: 'Shipper',
      queueHref: '/warehouse/ship',
      queueLabel: 'Orders to ship',
      verb: 'ship',
    },
  };

  const { icon: Icon, label, queueHref, queueLabel, verb } = META[role];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}.</h1>
        <p className="text-muted-foreground text-sm">
          You&apos;re signed in as a <strong>{label}</strong>. Your work for today is below.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-lg">
              <Icon className="size-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {queueLabel}
              </p>
              <p className="text-3xl font-semibold tabular-nums">{queueCount}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {queueCount === 0
                  ? 'Nothing in the queue right now — check back soon.'
                  : `Open the queue to ${verb} the next one.`}
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link href={queueHref}>
              Open queue
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Card>

      <p className="text-muted-foreground text-xs">
        Need to see something outside your role? An admin can give you additional access on the Team
        page.
      </p>
    </div>
  );
}
