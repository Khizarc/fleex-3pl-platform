import { Ban, ClipboardCheck, CircleDot, Package, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OrderActivityEvent } from '@/features/orders/services/get-order-activity';
import { cn } from '@/lib/utils';

const META: Record<OrderActivityEvent['kind'], { icon: LucideIcon; label: string; tone: string }> =
  {
    submitted: { icon: CircleDot, label: 'Submitted', tone: 'text-blue-600 bg-blue-100' },
    allocated: { icon: CircleDot, label: 'Allocated', tone: 'text-blue-600 bg-blue-100' },
    picked: { icon: ClipboardCheck, label: 'Picked', tone: 'text-amber-600 bg-amber-100' },
    packed: { icon: Package, label: 'Packed', tone: 'text-amber-600 bg-amber-100' },
    shipped: { icon: Send, label: 'Shipped', tone: 'text-emerald-600 bg-emerald-100' },
    cancelled: { icon: Ban, label: 'Cancelled', tone: 'text-red-600 bg-red-100' },
  };

export function OrderActivityFeed({ events }: { events: OrderActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground bg-muted/30 rounded-md border p-4 text-sm">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event, i) => {
        const m = META[event.kind];
        const Icon = m.icon;
        return (
          <li key={event.id} className="relative flex gap-3">
            {i < events.length - 1 ? (
              <div className="bg-border absolute top-7 left-3.5 h-[calc(100%-12px)] w-px" />
            ) : null}
            <div
              className={cn(
                'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full',
                m.tone,
              )}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <p className="text-sm">
                <span className="font-medium">{m.label}</span>
                {event.by ? <span className="text-muted-foreground"> · by {event.by}</span> : null}
              </p>
              {event.detail ? (
                <p className="text-muted-foreground text-xs">{event.detail}</p>
              ) : null}
              <p className="text-muted-foreground text-xs">{event.at.toLocaleString()}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
