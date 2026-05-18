# `features/inventory`

**Single responsibility:** the inventory domain — warehouse/zone/aisle/bin structure, products/SKUs (owned by Clients), and stock levels with `available | reserved | on_hold | damaged` status.

**Lands in:** Phase 1.

State machine: `inbound_expected → received → available → reserved → picked → packed → shipped` plus side states (`docs/ARCHITECTURE.md` §5).
