import type { InboundShipmentStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';

const LABEL: Record<InboundShipmentStatus, string> = {
  NOTIFIED: 'Notified',
  RECEIVING: 'Receiving',
  COMPLETED: 'Completed',
  COMPLETED_WITH_DISCREPANCIES: 'Completed (with discrepancies)',
};

const VARIANT: Record<InboundShipmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    NOTIFIED: 'outline',
    RECEIVING: 'secondary',
    COMPLETED: 'default',
    COMPLETED_WITH_DISCREPANCIES: 'destructive',
  };

export function InboundStatusBadge({ status }: { status: InboundShipmentStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
