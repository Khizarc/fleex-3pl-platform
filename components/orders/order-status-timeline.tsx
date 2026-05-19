import type { OrderStatus } from '@prisma/client';
import { Check, CircleSlash } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepState = 'done' | 'current' | 'upcoming' | 'attention';

interface Step {
  key: string;
  label: string;
  state: StepState;
}

interface OrderStatusTimelineProps {
  status: OrderStatus;
  cancelledAt?: Date | null;
}

// The 5-step happy-path ribbon. Cancelled overlays the whole bar; AWAITING_STOCK
// makes "Allocated" amber/attention; ON_HOLD/EXCEPTION render the current step
// as attention. Steps after the current one stay upcoming (gray).
function computeSteps(status: OrderStatus): Step[] {
  const stepKeys = ['submitted', 'allocated', 'picked', 'packed', 'shipped'] as const;
  const labels = ['Submitted', 'Allocated', 'Picked', 'Packed', 'Shipped'];

  // Map each status to: (a) the index of the current step, (b) whether the
  // current step is amber/attention rather than blue/current.
  const map: Record<OrderStatus, { current: number; attention?: boolean }> = {
    DRAFT: { current: 0 },
    SUBMITTED: { current: 0 },
    AWAITING_STOCK: { current: 1, attention: true },
    READY_TO_PICK: { current: 1 },
    PICKING: { current: 2, attention: true },
    PICKED: { current: 2 },
    PACKING: { current: 3, attention: true },
    PACKED: { current: 3 },
    READY_TO_SHIP: { current: 4 },
    SHIPPED: { current: 4 },
    IN_TRANSIT: { current: 4 },
    DELIVERED: { current: 4 },
    CANCELLED: { current: -1 },
    ON_HOLD: { current: 1, attention: true },
    EXCEPTION: { current: 1, attention: true },
    PARTIALLY_SHIPPED: { current: 4, attention: true },
  };

  const { current, attention } = map[status];

  return stepKeys.map((key, i) => {
    let state: StepState;
    if (status === 'DELIVERED') {
      state = 'done';
    } else if (i < current) {
      state = 'done';
    } else if (i === current) {
      state = attention ? 'attention' : 'current';
    } else {
      state = 'upcoming';
    }
    return { key, label: labels[i]!, state };
  });
}

// What the user should do next. Reads off the same status — single source of
// truth so the timeline and the callout never disagree.
function nextActionCopy(status: OrderStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Submit the order to start fulfillment.';
    case 'SUBMITTED':
      return 'Allocating stock — this usually completes immediately.';
    case 'AWAITING_STOCK':
      return 'Waiting for inbound stock to be received before allocation can complete.';
    case 'READY_TO_PICK':
      return 'Ready to pick — assign to a picker or go to the pick queue.';
    case 'PICKING':
      return 'Currently being picked.';
    case 'PICKED':
      return 'Picked — ready to pack.';
    case 'PACKING':
      return 'Currently being packed.';
    case 'PACKED':
      return 'Packed — ready to ship.';
    case 'READY_TO_SHIP':
      return 'Ready to ship — print label and dispatch.';
    case 'SHIPPED':
      return 'Shipped — tracking is live.';
    case 'IN_TRANSIT':
      return 'In transit with the carrier.';
    case 'DELIVERED':
      return 'Delivered.';
    case 'CANCELLED':
      return 'Order was cancelled. Reserved stock has been returned to inventory.';
    case 'ON_HOLD':
      return 'On hold — staff intervention required to resume.';
    case 'EXCEPTION':
      return 'Flagged with an exception — review and resolve.';
    case 'PARTIALLY_SHIPPED':
      return 'Partially shipped — remaining lines are still in flight.';
  }
}

export function OrderStatusTimeline({ status, cancelledAt }: OrderStatusTimelineProps) {
  const steps = computeSteps(status);
  const isCancelled = status === 'CANCELLED';

  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <div className={cn('relative', isCancelled && 'opacity-50')}>
        <ol className="flex items-center gap-2">
          {steps.map((step, i) => (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border text-xs font-medium',
                    step.state === 'done' && 'border-emerald-500 bg-emerald-500 text-white',
                    step.state === 'current' && 'border-blue-500 bg-blue-500 text-white',
                    step.state === 'attention' && 'border-amber-500 bg-amber-500 text-white',
                    step.state === 'upcoming' &&
                      'border-muted-foreground/30 text-muted-foreground bg-background',
                  )}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                >
                  {step.state === 'done' ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    'mb-5 h-px flex-1',
                    steps[i + 1]!.state === 'upcoming'
                      ? 'bg-muted-foreground/20'
                      : 'bg-emerald-500',
                  )}
                />
              ) : null}
            </li>
          ))}
        </ol>
        {isCancelled ? (
          <div className="bg-card/80 absolute inset-0 flex items-center justify-center">
            <div className="text-destructive inline-flex items-center gap-2 text-sm font-medium">
              <CircleSlash className="size-4" />
              Cancelled
              {cancelledAt ? ` on ${new Date(cancelledAt).toLocaleDateString()}` : ''}
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground border-t pt-3 text-sm">{nextActionCopy(status)}</p>
    </div>
  );
}
