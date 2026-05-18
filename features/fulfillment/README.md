# `features/fulfillment`

**Single responsibility:** pick / pack / ship — the warehouse-floor workflow that drives an Order from `ready_to_pick` to `shipped`. Pick queue, scan-to-confirm, pack screen with personalization, manual label entry (Phase 1) or purchased label (Phase 3).

**Lands in:** Phase 1 (with manual label entry); Phase 3 adds purchased labels via EasyPost.
