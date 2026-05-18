import { AccountStatus, OrderStatus, type Order } from '@prisma/client';
import { withTenantContext } from '@/lib/db';
import type { TenantContext } from '@/lib/tenancy';
import type { AssignOrderInput } from '../validation';

// Assign an order to a staff member (or unassign with null). Constraints:
//   - Assignee must be in the same company AND status === ACTIVE.
//   - Order status must NOT be terminal (SHIPPED / DELIVERED / CANCELLED) —
//     assignment is meaningful only pre-ship.

export class CannotAssignTerminalOrderError extends Error {
  readonly status: OrderStatus;
  constructor(status: OrderStatus) {
    super(`Cannot change assignment on a ${status} order.`);
    this.name = 'CannotAssignTerminalOrderError';
    this.status = status;
  }
}

export class InvalidAssigneeError extends Error {
  constructor(reason: string) {
    super(`Invalid assignee: ${reason}`);
    this.name = 'InvalidAssigneeError';
  }
}

const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

export async function assignOrder(ctx: TenantContext, args: AssignOrderInput): Promise<Order> {
  return withTenantContext(ctx, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: args.orderId },
      select: { id: true, status: true, companyId: true },
    });

    if (TERMINAL_STATUSES.includes(order.status)) {
      throw new CannotAssignTerminalOrderError(order.status);
    }

    if (args.assignedToUserId !== null) {
      const assignee = await tx.user.findUnique({
        where: { id: args.assignedToUserId },
        select: { companyId: true, status: true },
      });
      if (!assignee) {
        throw new InvalidAssigneeError('user not found');
      }
      if (assignee.companyId !== ctx.companyId) {
        throw new InvalidAssigneeError('user belongs to a different company');
      }
      if (assignee.status !== AccountStatus.ACTIVE) {
        throw new InvalidAssigneeError('user is not active');
      }
    }

    return tx.order.update({
      where: { id: order.id },
      data: { assignedToUserId: args.assignedToUserId },
    });
  });
}
