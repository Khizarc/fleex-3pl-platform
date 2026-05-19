import type { OrderStatus } from '@prisma/client';
import {
  Ban,
  CheckCheck,
  CircleAlert,
  CircleDashed,
  CircleDot,
  Clock,
  PauseCircle,
  PackageCheck,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// 5-color semantic palette grouping the 16 OrderStatuses by user intent.
//
// neutral  = not yet in the pipeline (DRAFT)
// info     = queued waiting for staff action (SUBMITTED, READY_TO_PICK, READY_TO_SHIP)
// active   = work in progress or upstream blocker (AWAITING_STOCK, PICKING,
//            PICKED, PACKING, PACKED, PARTIALLY_SHIPPED)
// success  = goods are with the carrier (SHIPPED, IN_TRANSIT, DELIVERED)
// danger   = terminal/blocked failure path (CANCELLED, ON_HOLD, EXCEPTION)
type Intent = 'neutral' | 'info' | 'active' | 'success' | 'danger';

const META: Record<OrderStatus, { label: string; intent: Intent; icon: LucideIcon }> = {
  DRAFT: { label: 'Draft', intent: 'neutral', icon: CircleDashed },
  SUBMITTED: { label: 'Submitted', intent: 'info', icon: CircleDot },
  AWAITING_STOCK: { label: 'Awaiting stock', intent: 'active', icon: Clock },
  READY_TO_PICK: { label: 'Ready to pick', intent: 'info', icon: CircleDot },
  PICKING: { label: 'Picking', intent: 'active', icon: Clock },
  PICKED: { label: 'Picked', intent: 'active', icon: PackageCheck },
  PACKING: { label: 'Packing', intent: 'active', icon: Clock },
  PACKED: { label: 'Packed', intent: 'active', icon: PackageCheck },
  READY_TO_SHIP: { label: 'Ready to ship', intent: 'info', icon: CircleDot },
  SHIPPED: { label: 'Shipped', intent: 'success', icon: Truck },
  IN_TRANSIT: { label: 'In transit', intent: 'success', icon: Truck },
  DELIVERED: { label: 'Delivered', intent: 'success', icon: CheckCheck },
  CANCELLED: { label: 'Cancelled', intent: 'danger', icon: Ban },
  ON_HOLD: { label: 'On hold', intent: 'danger', icon: PauseCircle },
  EXCEPTION: { label: 'Exception', intent: 'danger', icon: CircleAlert },
  PARTIALLY_SHIPPED: { label: 'Partially shipped', intent: 'active', icon: Truck },
};

const INTENT_CLASS: Record<Intent, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  active:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  success:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  danger:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, intent, icon: Icon } = META[status];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        INTENT_CLASS[intent],
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
