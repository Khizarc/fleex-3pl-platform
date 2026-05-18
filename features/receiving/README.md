# `features/receiving`

**Single responsibility:** the receiving domain — inbound shipment notices, scan-and-verify check-in, bin assignment, discrepancy and damage capture.

**Lands in:** Phase 1 (core fulfillment loop).

State machine: `notified → in_transit → arrived → receiving → completed | completed_with_discrepancies` (`docs/ARCHITECTURE.md` §5).
