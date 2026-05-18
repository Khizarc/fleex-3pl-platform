// State machine for Order (Milestone 1.5). Second state machine in the
// codebase; mirrors the shape of features/inbound/state-machine.ts.
//
// The full OrderStatus enum is declared in the schema so it's stable across
// 1.5–1.10, but only the subset of transitions 1.5 needs is wired here. Every
// other state maps to `[]` — `assertTransition` will reject any move out of
// them with IllegalStateTransitionError, and the surrounding transaction
// rolls back.

import { OrderStatus } from '@prisma/client';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [],
  SUBMITTED: [OrderStatus.AWAITING_STOCK, OrderStatus.READY_TO_PICK, OrderStatus.CANCELLED],
  AWAITING_STOCK: [OrderStatus.READY_TO_PICK, OrderStatus.CANCELLED],
  READY_TO_PICK: [OrderStatus.CANCELLED, OrderStatus.PICKING],
  PICKING: [OrderStatus.PICKED],
  PICKED: [],
  PACKING: [],
  PACKED: [],
  READY_TO_SHIP: [],
  SHIPPED: [],
  IN_TRANSIT: [],
  DELIVERED: [],
  CANCELLED: [],
  ON_HOLD: [],
  EXCEPTION: [],
  PARTIALLY_SHIPPED: [],
};

export class IllegalStateTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;

  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Illegal Order transition: ${from} → ${to}`);
    this.name = 'IllegalStateTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}
