import type { OrderStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';

const LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  AWAITING_STOCK: 'Awaiting stock',
  READY_TO_PICK: 'Ready to pick',
  PICKING: 'Picking',
  PICKED: 'Picked',
  PACKING: 'Packing',
  PACKED: 'Packed',
  READY_TO_SHIP: 'Ready to ship',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On hold',
  EXCEPTION: 'Exception',
  PARTIALLY_SHIPPED: 'Partially shipped',
};

const VARIANT: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  SUBMITTED: 'outline',
  AWAITING_STOCK: 'destructive',
  READY_TO_PICK: 'secondary',
  PICKING: 'secondary',
  PICKED: 'secondary',
  PACKING: 'secondary',
  PACKED: 'secondary',
  READY_TO_SHIP: 'secondary',
  SHIPPED: 'default',
  IN_TRANSIT: 'default',
  DELIVERED: 'default',
  CANCELLED: 'outline',
  ON_HOLD: 'destructive',
  EXCEPTION: 'destructive',
  PARTIALLY_SHIPPED: 'secondary',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
