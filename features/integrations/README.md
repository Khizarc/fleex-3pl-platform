# `features/integrations`

**Single responsibility:** marketplace and accounting integrations — Shopify, Amazon, WooCommerce (Phase 4); QuickBooks (Phase 5). Each platform is its own milestone — never batched (`docs/BUILD-PLAN.md` §7).

**Reuses:** `Integration` and `SyncLog` entities from the shared schema (`docs/ARCHITECTURE.md` §4). Credentials/tokens stored encrypted at rest — never in the repo.

**Amazon caveat:** SP-API approval is requested at Phase 1 start because it takes weeks (`docs/BUILD-PLAN.md` §10).
