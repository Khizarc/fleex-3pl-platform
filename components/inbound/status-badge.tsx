import type { InboundShipmentStatus } from '@prisma/client';
import { CheckCheck, Clock, CircleAlert, CircleDot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Intent = 'info' | 'active' | 'success' | 'danger';

const META: Record<InboundShipmentStatus, { label: string; intent: Intent; icon: LucideIcon }> = {
  NOTIFIED: { label: 'Notified', intent: 'info', icon: CircleDot },
  RECEIVING: { label: 'Receiving', intent: 'active', icon: Clock },
  COMPLETED: { label: 'Completed', intent: 'success', icon: CheckCheck },
  COMPLETED_WITH_DISCREPANCIES: {
    label: 'Completed (with discrepancies)',
    intent: 'danger',
    icon: CircleAlert,
  },
};

const INTENT_CLASS: Record<Intent, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  active:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  success:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  danger:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
};

export function InboundStatusBadge({ status }: { status: InboundShipmentStatus }) {
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
