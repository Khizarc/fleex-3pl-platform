# `features/shipping`

**Single responsibility:** the EasyPost integration — rate comparison across carriers, label purchase, address validation, tracking-number retrieval, batch processing.

**Lands in:** Phase 3.

Label markup flows into the BillableEvent ledger (see `features/billing`). Tracking updates fire notifications under the Company's brand.
