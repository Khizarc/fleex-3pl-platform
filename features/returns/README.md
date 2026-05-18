# `features/returns`

**Single responsibility:** client-initiated returns and inspection — `ReturnRequest` and `ReturnInspection`, with restock/quarantine/dispose outcomes that feed back into the inventory item state machine.

**Lands in:** Phase 5 (full client-initiated flow + inspection/grading).

State machine: `requested → approved (optional) → in_transit → received → inspecting → resolved (restock | quarantine | dispose) | rejected` (`docs/ARCHITECTURE.md` §5).
