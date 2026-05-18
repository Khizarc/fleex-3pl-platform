# `features/orders`

**Single responsibility:** the orders domain — Order + OrderLineItem + PersonalizationDetail entities, manual entry and CSV bulk upload (Phase 1), and the validated order state machine.

**Lands in:** Phase 1 (manual/CSV only — marketplace sync arrives in Phase 4).

State machine: `draft → submitted → ready_to_pick → picking → picked → packing → packed → ready_to_ship → shipped → in_transit → delivered`, plus side states `on_hold | cancelled | exception | partially_shipped` (`docs/ARCHITECTURE.md` §5).
