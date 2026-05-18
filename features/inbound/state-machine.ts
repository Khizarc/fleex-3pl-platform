// State machine for InboundShipment (Milestone 1.3).
// First state machine in the codebase — sets the pattern that 1.5 orders and
// Phase 5 returns will follow.
//
// Per CLAUDE.md: state changes go through the validated transition layer,
// never direct status writes. Services call `assertTransition` before any
// UPDATE; an illegal transition throws synchronously and the transaction
// rolls back.

import { InboundShipmentStatus } from '@prisma/client';

const VALID_TRANSITIONS: Record<InboundShipmentStatus, InboundShipmentStatus[]> = {
  NOTIFIED: [InboundShipmentStatus.RECEIVING],
  RECEIVING: [InboundShipmentStatus.COMPLETED, InboundShipmentStatus.COMPLETED_WITH_DISCREPANCIES],
  COMPLETED: [], // terminal
  COMPLETED_WITH_DISCREPANCIES: [], // terminal
};

export class IllegalStateTransitionError extends Error {
  readonly from: InboundShipmentStatus;
  readonly to: InboundShipmentStatus;

  constructor(from: InboundShipmentStatus, to: InboundShipmentStatus) {
    super(`Illegal InboundShipment transition: ${from} → ${to}`);
    this.name = 'IllegalStateTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from: InboundShipmentStatus, to: InboundShipmentStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}
