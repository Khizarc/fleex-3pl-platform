# `features/billing`

**Single responsibility:** money — PricingRule engine (per-Company rates with per-Client overrides), the append-only BillableEvent ledger, invoice generation, and Stripe payment collection at a balance threshold.

**Lands in:** Phase 2.

**Non-negotiable rule (`CLAUDE.md`):** BillableEvents are written at event time and never recalculated; invoicing reads the ledger and never re-derives history. All payment operations are idempotent.

State machine (Invoice): `draft → finalized → sent → paid | partially_paid | overdue | void` (`docs/ARCHITECTURE.md` §5).
