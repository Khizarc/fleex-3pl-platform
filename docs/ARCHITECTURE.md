# Architecture — Fleex 3PL Platform

> **Purpose:** The technical reference for the project. Records *what* was decided, *why*, and *when*. When a decision changes, update this file and note the date.
> **Companion documents:** `BUILD-PLAN.md` (the phased execution plan) and `CLAUDE.md` (standing instructions for Claude Code).
> **Audience:** The developer(s) and Claude Code.

---

## 1. System overview

This is a multi-tenant 3PL (third-party logistics) warehouse and shipping platform. Stripped of marketing language, it is **four interlocking systems**:

1. **Multi-tenant backbone** — many 3PL companies, each with many of their own clients, each with strictly isolated data.
2. **Two front-end apps, one backend** — the **Warehouse Dashboard** (3PL staff) and the **Client Portal** (the 3PL's customers), sharing one database and business logic.
3. **A workflow / state engine** — physical objects (inventory, orders, returns) move through validated state machines.
4. **Integration layer** — Shopify, Amazon, WooCommerce, shipping carriers, QuickBooks, Stripe.

**Mental model:** *A state machine for physical objects, wrapped in a multi-tenant permission system, with two front doors and several external pipes.*

---

## 2. The stack (decided)

**One line:** Next.js (TypeScript, strict) + PostgreSQL + Prisma, on managed infrastructure.

| Layer | Decision | Date | Reasoning |
|---|---|---|---|
| **Framework** | Next.js + TypeScript, **`strict` mode from commit 1** | Locked | Two front-ends share one backend → one full-stack framework beats a split frontend/API with a hand-maintained contract. Strict TypeScript end-to-end is the biggest bug-prevention lever: types flow from DB row → API → UI, so breaking changes fail at compile time. Also the stack Claude Code is most fluent in. |
| **Database** | PostgreSQL (hosted on **Neon**) | Locked | The domain is deeply relational. Postgres provides **Row-Level Security**, on which the entire tenant-isolation strategy depends. Neon for managed hosting + branchable databases (useful for staging/preview). |
| **ORM** | Prisma | Locked | The schema is the app's spine — version-controlled, typed, migration-driven. Generated types extend end-to-end type safety down to the database. |
| **Auth** | **Clerk** | Locked | Managed, never hand-rolled. Fast to wire up; handles the two-level company/client tenancy and role-based access; strong Next.js integration. |
| **Background jobs** | **Upstash QStash** (managed queue) | Locked | Marketplace syncs, batch labels, scheduled reports, auto-billing run outside the request cycle. Managed queue avoids self-hosting worker infra early. Revisit if job orchestration grows complex. |
| **Payments** | **Stripe** | Locked | "Auto-collect at a balance threshold" means handling real money. Stripe holds card data → platform stays out of PCI scope. Hard requirement. |
| **File storage** | S3-compatible object storage | Locked | Personalization artwork, damage photos, packing slips, invoice PDFs. Never on the app server. Specific provider TBD (S3 or compatible). |
| **Carrier integration** | **EasyPost** (aggregator) | Locked | One API across all major carriers — rate comparison, labels, tracking, address validation. Far less work than direct carrier integrations for v1. |
| **Hosting** | **Vercel** (app) + **Neon** (Postgres) + **Upstash** (Redis/QStash) | Locked | Lowest ops burden, best Next.js fit, all managed. Keeps effort on product, not infrastructure. |
| **Tooling** | ESLint + Prettier + pre-commit hook + CI (typecheck/lint/test on every push) | Locked | The enforcement layer for clean, bug-free code. Set up in Phase 0, not later. |

### Why this stack fits *this* app
- **Two front-ends, one backend** → one full-stack framework (Next.js).
- **Deeply relational + multi-tenant** → PostgreSQL with RLS.
- **Money + integrations everywhere** → end-to-end TypeScript types catch payload mismatches at compile time.
- **Build tool is Claude Code** → it is strongest in this exact stack.

### Still open (configuration within the stack, not the stack itself)
- Specific object-storage provider.
- Invoice/billing period model (calendar month vs. rolling vs. per-client configurable) — see `BUILD-PLAN.md` §12.
- Marketplace sync mechanism per platform (webhook vs. polling) — see `BUILD-PLAN.md` §12.
- Product name (the proposal says "name pending") — needed before Phase 5 white-labeling.

---

## 3. Multi-tenancy — the most important architectural decision

### Two levels of tenancy
- **Company** — the 3PL business using the platform (the paying customer).
- **Client** — that 3PL's own customer, who logs into the Client Portal.

Company staff can see all of that company's clients. A client sees **only their own** data — never another client's, never the company's internal operations. **Both boundaries are enforced.**

### Strategy: `tenant_id` column + Postgres Row-Level Security (RLS)
- Every table except top-level `Company` carries a `tenant_id` (the owning company) — ownership is explicit and queries are efficient.
- **RLS policies** make isolation a guarantee enforced by Postgres itself: a missing `WHERE` clause in application code *cannot* leak data across tenants.
- Every request sets the tenant context (current company, and where relevant the current client) before any query runs. This is middleware — written once, tested hard, never bypassed.

### Why not the alternatives
- **`tenant_id` column alone** — relies on every query being written correctly forever. One mistake = silent cross-tenant leak. Unacceptable for a 3PL platform.
- **Schema-per-tenant / DB-per-tenant** — strongest isolation but makes migrations and cross-tenant platform operations painful; scales awkwardly past a few dozen tenants.

### Enforcement
- Tenant-context middleware runs on every request.
- New tables get `tenant_id` + an RLS policy **in the same migration** — never a follow-up.
- Automated isolation tests ("can Client A read Client B's data?") run in CI from Phase 0 onward. A failure blocks the build.

---

## 4. Data model

The spine of the app. Build the full Prisma schema for the core tenancy entities before coding features. Every table except `Company` carries `tenant_id` and is covered by RLS.

### Core tenancy & identity
- **Company** — the 3PL business. Branding fields (logo, name, colors) for white-labeling. Billing settings.
- **User** — belongs to a Company. Has a **Role** (admin, picker, packer, shipper, receiver). May be assigned to specific warehouse locations.
- **Client** — a customer of the Company. Own portal login(s). Custom pricing overrides; customizable personalization field definitions.
- **ClientUser** — login identity for a Client (a client may have several people).

### Warehouse structure
- **Warehouse** — a physical location belonging to a Company.
- **Zone / Aisle / Bin** — nested location hierarchy within a Warehouse. Inventory lives in Bins.

### Inventory & receiving
- **Product / SKU** — belongs to a Client (the client owns the goods). Definition only.
- **InventoryItem / StockLevel** — quantity of a SKU in a specific Bin, with status: `available`, `reserved`, `on_hold`, `damaged`.
- **InboundShipment** — a client's notice that stock is arriving: expected contents, destination warehouse, status.
- **ReceivingRecord** — what was actually checked in against an InboundShipment, by whom, with discrepancy/damage notes and photos.

### Orders & fulfillment
- **Order** — belongs to a Client. Shipping address, status, source (manual, CSV, Shopify, Amazon…).
- **OrderLineItem** — a SKU + quantity on an Order.
- **PersonalizationDetail** — custom fields attached to an order or line item (text, selections, file uploads, instructions). Field definitions are per-Client.
- **PickTask / PackTask** — work assigned to staff; links Order to Bin locations and the assigned User.
- **Shipment** — carrier, service, label, tracking number, cost. Linked to an Order.

### Returns
- **ReturnRequest** — initiated by a Client from the portal.
- **ReturnInspection** — graded outcome: `restock`, `quarantine`, `dispose`.

### Billing
- **PricingRule** — a Company's rate for a service (per order, pick fee, pack fee, box size, storage, receiving, label markup, returns, special handling, minimums). Supports **per-Client overrides**.
- **BillableEvent** — append-only ledger row: event type, quantity, the PricingRule applied, computed amount, timestamp, related entity. Written when the event happens.
- **Invoice** — generated from BillableEvents for a Client over a period; line items, totals, status.
- **Payment** — a collection attempt/result against an Invoice or balance (Stripe).

### Integrations & audit
- **Integration** — a connected external account (Shopify store, Amazon seller, QuickBooks, carrier) belonging to a Company or Client. Stores credentials/tokens **encrypted**.
- **SyncLog** — record of each sync run: what, when, success/failure, errors.
- **AuditLog** — append-only: actor, action, entity, before/after, timestamp. Cross-cutting.
- **Notification** — tracking updates, alerts, status emails sent under the Company's brand.

> This is the **starting point**. Expect to discover missing entities (kitting/bundles, cycle-count sessions) during Phase 2–3. Add them deliberately, with a migration, and update this section.

---

## 5. State machines

Most bugs in this kind of app are illegal state transitions. Every status and every legal transition is defined; the service layer rejects anything not on the list.

### Order status
```
draft → submitted → awaiting_stock(optional) → ready_to_pick → picking
→ picked → packing → packed → ready_to_ship → shipped → in_transit → delivered
```
Side states from defined points: `on_hold`, `cancelled`, `exception`, `partially_shipped`.

### Inventory item status
```
inbound_expected → received → available
available → reserved (allocated to an order)
reserved → picked → packed → shipped
any → on_hold / damaged (with reason + actor)
returned → inspecting → (restocked → available | quarantined | disposed)
```

### Inbound shipment status
```
notified → in_transit → arrived → receiving → completed (or completed_with_discrepancies)
```

### Return request status
```
requested → approved(optional) → in_transit → received → inspecting
→ resolved(restock | quarantine | dispose) (or rejected)
```

### Invoice status
```
draft → finalized → sent → (paid | partially_paid | overdue | void)
```

For each machine, document **who** can trigger each transition and **what side effects** fire (e.g. `shipped` triggers a tracking notification and a BillableEvent).

---

## 6. Code organization

A first-class requirement, weighted equally with tenant isolation. Full rules in `BUILD-PLAN.md` §3a. Summary of the structural rules:

- **No giant files.** A file approaching a few hundred lines is a signal to split. "Thousands of lines in one file" is always wrong.
- **One file, one responsibility** — nameable in a single sentence.
- **Feature-oriented folders** — organize by domain (receiving, inventory, orders, billing, shipping), not by lumping all routes or all components together.
- **Layer separation** — database access, services (business logic), API routes, and UI components live in distinct files. Components never run raw queries; routes never hold business logic.
- **Shared logic extracted once** — pricing math, state-transition validation, tenant helpers — never copy-pasted.
- **Refactor in-milestone** — when a file gets too big, split it as part of the current work, never "later."

### Indicative folder structure
```
/app
  /(warehouse)        ← Warehouse Dashboard routes
  /(portal)           ← Client Portal routes
  /api                ← API route handlers (thin — call services)
/lib
  /db                 ← Prisma client, tenant-context middleware
  /auth               ← Clerk integration, role checks
  /tenancy            ← tenant-context helpers, isolation utilities
/features
  /receiving          ← services, components, types for receiving
  /inventory
  /orders
  /fulfillment        ← pick / pack / ship
  /returns
  /billing            ← pricing rules, billable events, invoicing
  /shipping           ← EasyPost integration
  /integrations       ← Shopify, Amazon, WooCommerce, QuickBooks
  /analytics
/components            ← shared, presentational UI only
/tests
```
This is indicative — adjust as the app grows, but keep the feature-oriented and layer-separated principles.

---

## 7. Security & data protection

- **Tenant isolation tests run in CI** from Phase 0. A failure blocks the build.
- **Auth never hand-rolled** (Clerk). Role checks enforced on every endpoint, not just hidden in the UI.
- **Secrets & credentials** — marketplace tokens, EasyPost keys, QuickBooks tokens stored **encrypted at rest**. Never in the repo. Environment-based config.
- **Payments** — Stripe holds card data; never store raw card numbers. All money operations are **idempotent** (a retried charge must not double-bill) and logged.
- **Audit log** — every sensitive action (receiving, shipping, price changes, payments, permission changes) recorded immutably.
- **File uploads** — validate type/size, scan personalization artwork and photos, store in object storage.
- **PII** — shipping addresses and contact info are personal data; access-controlled and covered by isolation.
- **Backups** — automated, with a *tested* restore procedure.

---

## 8. Environments & secrets

| Environment | Purpose | Database |
|---|---|---|
| **Local (dev)** | Day-to-day development | Local Postgres or a Neon dev branch |
| **Staging** | Pre-production testing, integration sandboxes | Neon staging branch |
| **Production** | Live | Neon production |

- All secrets via environment variables — never committed. A `.env.example` lists every required variable with placeholder values.
- Each environment has its own Clerk instance/keys, Stripe keys (test vs. live), EasyPost keys (test vs. production), and database URL.
- Integration sandboxes (Stripe test mode, EasyPost test mode, Shopify dev store, QuickBooks sandbox) are used everywhere except production.
- The production payment and carrier keys are live — treat with extra care; never used in local or staging.

---

## 9. Decision log

| Date | Decision | Notes |
|---|---|---|
| Project start | Stack locked: Next.js + TS strict + PostgreSQL + Prisma | See §2 |
| Project start | Multi-tenancy: `tenant_id` + RLS | See §3 |
| Project start | Auth: Clerk | Managed, not hand-rolled |
| Project start | Hosting: Vercel + Neon + Upstash | Managed across the board |
| Project start | Background jobs: Upstash QStash | Revisit if orchestration grows complex |
| Project start | Carrier integration: EasyPost (aggregator) | Direct carrier APIs deferred |
| 2026-05-17 | RLS enforced via two-role pattern on a single connection string | Owner role (`neondb_owner` on Neon / `postgres` in CI) is used for migrations + test fixture setup and bypasses RLS naturally. App runtime queries go through `withTenantContext` (lib/db/tenant-context.ts) which opens a transaction, runs `SET LOCAL ROLE app_user`, then sets `app.current_company_id` and `app.current_client_id` via `set_config(..., true)`. Policies use `current_setting('...', true)`. Both context vars are always set (empty string sentinel for missing client) so policy OR-arms don't short-circuit on NULL. |
| 2026-05-17 | CI tests against ephemeral Postgres 16 service | Neon test-branch testing deferred to Phase 6 (hardening). RLS is a Postgres feature, identical semantics on Neon vs. vanilla Postgres. |
| 2026-05-17 | Self-serve auto-provisioning for staff sign-ups (Milestone 0.3) | Sign-up via Clerk → on first visit to `/warehouse`, `lib/auth/current-user.ts` auto-creates a new Company + admin User row in a transaction. Race-safe via the `User.authProviderId` unique constraint + P2002 retry. ClientUser provisioning remains admin-driven (deferred to Milestone 0.5's admin invite UI). Auth lookup uses the owner Prisma client; all post-resolution queries go through `withTenantContext`. |
| 2026-05-17 | UI stack: Tailwind v4 + shadcn/ui (Milestone 0.4) | The modern B2B SaaS production default. shadcn components are copied into `components/ui/` and owned by us; built on Radix UI primitives for accessibility. Our own layout chrome lives in `components/layout/` (AppShell, AppHeader, AppSidebar, SidebarNavItem). Design tokens are CSS variables in `app/globals.css` (`--background`, `--primary`, `--sidebar-*`, etc.) mapped to Tailwind utilities via the `@theme inline` directive. Phase 5 white-labeling will swap CSS-variable values per Company without changing component code. Auth helpers wrapped in React `cache()` so the route-group layout and child pages share one resolution per request. |
| 2026-05-17 | Claim-by-email pattern for ClientUser provisioning (Milestone 0.5) | `ClientUser.authProviderId` made nullable. Admin pre-creates ClientUser rows with `authProviderId = NULL`; on the invitee's first authenticated request, the auth helpers (`lib/auth/current-user.ts`) match by email and claim the row via a race-safe `updateMany` filtered on `authProviderId IS NULL`. Lets us defer real email-sending without blocking Phase 0 acceptance. Phase 0 closed by `tests/integration/clients.test.ts` — API-level isolation proven via RLS `WITH CHECK` rejecting cross-tenant INSERTs and `USING` filter hiding cross-tenant SELECTs. Forms use shadcn `<Form>` + `react-hook-form` + `zod`. |
| 2026-05-17 | Warehouse structure (Milestone 1.1) | Four nested tenant-scoped entities — `Warehouse → Zone → Aisle → Bin`. `companyId` denormalized on each level so RLS policies filter without joining (same pattern as `ClientUser.companyId`). Child-creation services derive `companyId` from the parent row inside the transaction; RLS WITH CHECK is defense-in-depth at the DB. UI is minimal (list + create only) — edits/deletes/transfers deferred per CLAUDE.md "don't add features beyond what the task requires." |
| 2026-05-17 | Products + SKUs with two-level RLS (Milestone 1.2) | Catalog tables (`Product → SKU`) owned by `Client`. RLS uses the same Company + optional Client pattern as `Client`/`ClientUser`: staff context (no client_id set) sees all clients' products of their company; portal context (client_id set) sees only own-client rows. First feature visible in both shells — shared `components/products/*` (table + dialog) accept the server action as a prop, so the dialog code is identical between `/warehouse/clients/[id]/...` and `/portal/products/...`. SKU codes unique per client (`@@unique([clientId, code])`). |
| 2026-05-17 | Inbound shipments + StockLevel materialization (Milestone 1.3) | First multi-step workflow with state. Three new tables (`InboundShipment`, `InboundShipmentLine`, `StockLevel`) + two enums (`InboundShipmentStatus`, `StockLevelStatus`). Validated state machine in `features/inbound/state-machine.ts` — first one in the codebase, sets the pattern for orders (1.5) and returns (Phase 5). Receiving materializes `StockLevel` via Prisma `upsert` keyed on `(skuId, binId, status)`; concurrent receives into the same bin × SKU resolve via Postgres row locking. Damaged goods land in a separate `(sku, bin, DAMAGED)` row so they're not pickable. Two-level RLS on all three tables. Damage photos deferred — `notes` text field for 1.3; real file upload is its own small milestone (Vercel Blob). |
| 2026-05-18 | Inventory views via Prisma groupBy aggregation (Milestone 1.4) | Read-side milestone — no new schema. `listInventoryBySku` does `tx.stockLevel.groupBy({ by: ['skuId', 'status'], _sum: { quantity: true } })` then joins SKU/Product/Client info in the app layer and pivots into one row per SKU with status columns. Same service primitive in both shells; RLS filters visibility (staff sees all clients, portal sees own only). By-location drill-in, pagination, and SKU search deferred until needed. Vitest `testTimeout` bumped to 15s to accommodate Neon round-trip latency for multi-transaction integration tests. |
| 2026-05-18 | Orders + atomic FIFO allocation (Milestone 1.5) | Second state machine in the codebase. Full `OrderStatus` enum declared (16 values, stable across 1.5–1.10); only the SUBMITTED / AWAITING_STOCK / READY_TO_PICK / CANCELLED transitions are wired in `features/orders/state-machine.ts`. Three new tables: `Order`, `OrderLineItem`, `OrderLineAllocation` — the allocation table stores the per-bin breakdown so 1.8 pick reads instead of recomputes FIFO (avoids a backfill migration later). Inline ship-to address on the order (no Address table — saved address book deferred to Phase 5). Allocation runs entirely in one tenant-scoped transaction: plan in memory across all lines, abort with zero side effects if any line is short, otherwise decrement AVAILABLE / upsert RESERVED / insert OrderLineAllocation. Cancel reverses precisely. Order references generated via `ORD-YYYYMMDD-####` per-company sequence; lookup runs against the owner client (bypassing RLS) so a portal caller doesn't collide with sibling clients' references, with `P2002` retry on the small remaining race. Concurrent-allocation race documented and guarded by a post-write negative-quantity assertion; `SELECT … FOR UPDATE` or `SERIALIZABLE` deferred until contention is observed. |
| 2026-05-18 | CSV bulk order upload (Milestone 1.6) | No new schema. Client-side parse via `papaparse` (header normalization to snake_case lowercase + cell trim + UTF-8 BOM handled). Validation is pure (`features/orders/csv/validate-rows.ts`) and groups rows by `order_reference`; that column is a **grouping key only**, never persisted (the 1.5 `createOrder` always generates `ORD-YYYYMMDD-####`). A persisted user-supplied `externalReference` is a polish item for later — out of 1.6 scope per CLAUDE.md "don't build beyond the task." The commit path is one server action (`importOrdersAction`) that re-resolves SKU codes server-side as the source of truth and runs `bulkCreateOrders`, which iterates `createOrder` **serially** — not `Promise.all` — to avoid contention against shared `StockLevel` rows (the documented 1.5 race becomes real under parallelism). Best-effort per file: per-order atomic from 1.5 is preserved; one bad row never rejects the whole CSV. Caps: 1000 rows, 2 MB. Staff path requires picking a client first (one upload = one client) — no `client_name` column. UX: client-side preview before commit, downloadable errors CSV, downloadable sample template (`public/orders-import-template.csv`), three-bucket results panel after commit. Phase 4 marketplace ingestion will reuse `bulkCreateOrders` as the common sink. |
| 2026-05-18 | Personalization fields (Milestone 1.7) | Per-Client custom fields captured per order LINE. Text values only. Two new tables: `PersonalizationField` (definitions) + `OrderLinePersonalization` (captured values). Field `key` is regex-enforced (`^[a-z][a-z0-9_]{0,49}$`) to match the 1.6 CSV header normalization — every definition can be a CSV column `personalization_<key>`. Soft-delete via `status = DISABLED` (FK `onDelete: Restrict`) so historical values never orphan; `key` is immutable once any captured value references the field. `fieldKey` is snapshotted on the value row so the pack screen (1.9) reads values without joining a possibly-disabled definition. `sortOrder` reserved as a column now to avoid a future backfill (no drag-to-reorder UI in 1.7). `createOrder` extension loads ACTIVE definitions inside the existing tx and validates atomically: unknown key, missing required, or over-500-chars all reject before any side effects. CSV validator extension recognizes `personalization_<key>` columns and surfaces unknown / disabled / required-missing as row errors so users can fix before commit. UI surfaces per-line dynamic inputs on manual order forms (both shells) and renders captured values inline on order detail. Portal admin at `/portal/personalization`; staff admin nested at `/warehouse/clients/[id]/personalization` (per-client, mirrors `/warehouse/clients/[id]/products/` precedent). Phase 4 marketplace adapters (Shopify line-item properties, etc.) map straight onto the same `personalization` line input. |
| 2026-05-18 | Pick — scan-to-confirm per allocation (Milestone 1.8) | Schema-light: two nullable columns on `OrderLineAllocation` (`pickedAt`, `pickedByUserId`) plus a User back-relation. No new tables. State machine adds `READY_TO_PICK → PICKING` (preserves the existing CANCELLED transition) and `PICKING → PICKED`. Cancel is forbidden once PICKING starts; mid-pick exception handling is deferred to a future EXCEPTION state. Per-allocation granularity: one click = one bin trip. Bin-label confirmation (trim + case-insensitive compare) sits where future barcode scanner hardware will paste text. Three new errors: `BinLabelMismatchError`, `AllocationAlreadyPickedError`, `BinNotActiveError`. Concurrency: `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE` at the top of `pickAllocation` serializes concurrent pickers on the same order, eliminating the double-final-transition race; `updateMany({ where: { id, pickedAt: null } })` guards against double-picking the same allocation. Picked goods leave inventory via RESERVED decrement; no new stock row — units live on the allocation (via `pickedAt`) until pack. Pick-list rows sorted by `(zone.name, aisle.name, bin.label)` so pickers walk a single pass through the warehouse. Staff-only routes at `/warehouse/pick` (queue) and `/warehouse/pick/[orderId]` (per-order screen). Action layer enforces `Role ∈ {ADMIN, PICKER}` and `user.status === ACTIVE` (the role gate is loose today since every staff user is auto-provisioned ADMIN; the shape is right for 1.11 team management). |
| 2026-05-18 | Pack — box dims + weight; PICKED → PACKED (Milestone 1.9) | Schema-light: six nullable columns on `Order` (`packedAt`, `packedByUserId`, `boxLengthMm`, `boxWidthMm`, `boxHeightMm`, `boxWeightG`, `packNotes`) plus `User.packsPerformed` back-relation. No new tables. State machine adds the single transition `PICKED → PACKED`. PACKING enum value stays unwired — a single-action transition has no need for an intermediate state until packer-assignment lands in 1.11. UI accepts inches + ounces (US 3PL convention); canonical storage is mm + grams (integers; no float drift; EasyPost-friendly). Conversion via `features/orders/units.ts` `inchesToMm` / `ouncesToGrams` at the form-submit boundary. Sanity caps in zod: 3000 mm max per dimension, 500_000 g max weight — catches the cm-as-inches footgun. Concurrency: mirror of 1.8 — `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE` lock + `updateMany({ where: { id, status: PICKED } })` belt-and-suspenders idempotency; second packer throws `OrderAlreadyPackedError`. Pack screen reuses `getOrder` (already returns lines + sku + allocations + personalizations) so the packer sees engraving / monogram / gift-note values prominently per line. `packedAt` lives on Order in 1.9 single-shipment scope; schema comment documents the future migration path to an `OrderShipment` table when split shipments land. Out of scope: box-template presets, pack-time photos, multi-package, fragile flag, packer assignment, un-pack. |
| 2026-05-18 | Ship — manual label entry; PACKED → SHIPPED (Milestone 1.10) | Closes the manual Phase 1 fulfillment loop. New `Carrier` Postgres enum (USPS / UPS / FEDEX / DHL / OTHER) + four nullable columns on Order (`shippedAt`, `shippedByUserId`, `carrier`, `carrierOther`, `trackingNumber`, `shipNotes`) + `User.shipsPerformed` back-relation. No new tables. State machine adds `PACKED → SHIPPED`; READY_TO_SHIP / IN_TRANSIT / DELIVERED stay terminal `[]` pending Phase 3 (EasyPost rate quotes + carrier webhooks). `carrierOther` is the long-tail escape hatch; the service nulls it server-side when carrier != OTHER so the column is a clean invariant ("non-null iff carrier == OTHER"). Concurrency: same belt-and-suspenders pattern as 1.8/1.9 — `SELECT ... FOR UPDATE` + `updateMany({ where: { id, status: PACKED } })`; second shipper throws `OrderAlreadyShippedError`. Tracking URL helper lives in `lib/carriers.ts` — pure map keyed on `Carrier`; insulates URL-drift risk and renders clickable links on order detail (both shells) for known carriers, plain text for OTHER. Role gate ADMIN | SHIPPER + user.status guard. No file upload (Phase 5 + Vercel Blob); no shipping cost capture (Phase 2 billing ledger); no carrier-purchasing (Phase 3 EasyPost). Tracking-number format validation deliberately skipped — each carrier has different patterns and 3PLs accept whatever the carrier prints. |
| 2026-05-18 | Team management — closes Phase 1 (Milestone 1.11) | Activates the role-gate scaffolding from 1.8–1.10. `User.authProviderId` becomes `String? @unique` so an ADMIN can pre-create staff rows via the new invite flow; the auth resolver (`lib/auth/current-user.ts`) claims the row on first sign-in. **Critical correctness constraint:** the resolution order keeps `ClientUser-by-authProviderId` BEFORE any email-based lookup, so a portal user whose email matches a pending staff invite is NOT silently claimed into staff. `Order.assignedToUserId` (nullable, `onDelete: SetNull`) records a per-order assignee — a hint, not a fence; the role gates remain the access-control surface. ADMIN sees an Assignee picker on order detail (active staff only); non-ADMIN sees read-only; disabled-assignee warning prompts reassignment. Queue pages (pick/pack/ship) gain an Assignee column. Inbound actions get the previously missing `ADMIN | RECEIVER` gate. New `features/team/` module: invite (typed `StaffEmailAlreadyExistsError` on P2002), role update, status update, assign order (rejects terminal statuses + non-ACTIVE/cross-company assignees), and the **last-active-ADMIN guard** (`assertNotLastActiveAdmin`) — blocks demoting or disabling the final ACTIVE ADMIN of a company. Productivity uses 4 parallel `groupBy` queries + JS merge across `InboundShipmentLine.receivedByUserId` / `OrderLineAllocation.pickedByUserId` / `Order.packedByUserId` / `Order.shippedByUserId`. `/warehouse/team` ADMIN-only page. Out of scope: invite expiry/resend, bulk invite, permission matrix, audit log, hard-delete, time-range productivity filters. |
| 2026-05-18 | Polish & onboarding — pre-Phase-2 UX pass (Milestone 1.12) | Closes the "feels clunky and confusing" gap before billing work lands on the surface. No schema or migration. Three shadcn primitives added (`alert-dialog`, `card`, `progress`) plus six project-local shared components: `<PageHeader>` (consolidates the hand-rolled `flex items-center justify-between` pattern across ~31 pages into one component with `backHref` / `description` / `action`); `<ConfirmDialog>` (AlertDialog wrapper, replaces `window.confirm` in cancel-order paths and gates destructive team-page status changes); `<StatCard>` (KPI tile used by both dashboards); `<OrderStatusTimeline>` (5-step ribbon: Submitted → Allocated → Picked → Packed → Shipped + cancelled overlay + amber "attention" state for AWAITING_STOCK / PICKING / PACKING / ON_HOLD / EXCEPTION / PARTIALLY_SHIPPED, plus a single-source-of-truth "What's next" callout reading off the same status); `<OnboardingChecklist>` (5-step interactive checklist on `/warehouse` with auto-collapse-to-success-pill when all done — derived from new `getOnboardingProgress` service, 5 parallel COUNT queries inside one tenant transaction, no schema). Status badges (`OrderStatusBadge` + `InboundStatusBadge`) collapsed from shadcn's 4 variants to a 5-color semantic palette (neutral / info-blue / active-amber / success-green / danger-red) + per-status lucide icon — the granular label stays, only the *color* is grouped. Two new dashboard aggregate services (`getStaffDashboard` and `getPortalDashboard`) under `features/dashboards/` — single round-trip per shell, KPI counts + "needs attention" rows (AWAITING_STOCK / ON_HOLD / EXCEPTION top 5) + today's activity (picks/packs/ships keyed on event timestamps). Both home pages rewritten: warehouse = greeting → onboarding → KPI strip → needs-attention + today; portal = greeting → KPI strip → recent orders + quick-action cards. EmptyState audit: every empty list now passes an `action` prop, so the "what should I do here?" affordance is in-frame instead of hidden top-right. 11 new integration tests (5 onboarding + 6 dashboards) cover RLS scoping and status filter correctness. Out of scope: custom illustrations, breadcrumbs, dark-mode tuning, time-range KPI filters, audit log, notifications. |

| 2026-05-18 | Flow of use & professional onboarding (Milestone 1.13) | Second polish milestone, building on 1.12. Goal: anyone landing on the product — non-authed visitor, fresh admin, invited picker, new portal user — knows what this is, what to do first, and recovers gracefully on error. No schema, no migration. **Public landing page** (`app/page.tsx`) — real B2B hero + "How it works" 3-card row + 4-card feature grid + branded CTA. **Demo data seeding** (`features/onboarding/seed-demo-data.ts` + `reset-demo-data.ts`) — one transaction populates 1 warehouse with 6 bins / 1 client + portal user invite / 1 personalization field / 3 products / 6 SKUs / 1 received inbound (with materialized StockLevel rows) / 1 SUBMITTED order with personalization values. Demo rows identified by known names ("Demo Distribution Center" / "Acme Demo Co" / "INB-DEMO-001" / "ORD-DEMO-" prefix). Reset deletes in explicit dependency order because PersonalizationField/SKU/Bin all have Restrict relations; user-created rows survive. **Welcome dialog** on first `/warehouse` hit (localStorage-dismissed) — "Load demo data" vs "Set up manually" branch. **Role-appropriate landings** — non-ADMIN staff (PICKER/PACKER/SHIPPER/RECEIVER) get a focused single-card "your queue today" view instead of the company-wide KPI dashboard; ADMIN keeps the full dashboard. **Workflow-grouped sidebar** — flat list → sections (Overview / Catalog / Inbound / Outbound / Admin); sidebar header gains role chip with hover tooltip describing what the role can do. Portal sidebar shows the client name as the "role" chip. **Per-page help drawer** — `<PageHeader helpKey="...">` renders a `?` button that opens a shadcn Sheet with "What this is for / How it works / Common tasks / Related." Content map for 15 key pages in `lib/page-help-content.ts`. **Order activity feed** — `getOrderActivity` derives events from existing timestamp + audit columns (no schema), `<OrderActivityFeed>` renders a vertical timeline with WHO did each step. **Branded error pages** — `app/(warehouse)/error.tsx` + `app/(portal)/error.tsx` replace Next's default stack-trace screen with a recoverable "Try again / Back to dashboard" card. **Order detail right-rail** — two-column grid; left = lines + activity, right = `<OrderSummaryCard>` (client / lines / qty / assignee / carrier / tracking) + ship-to + assignment controls (ShipBob-style three-pane compressed). **Smart cross-page empty states** — empty inventory + pending inbounds count → "You have N pending inbounds, start receiving"; empty pick queue + SUBMITTED/AWAITING_STOCK count → "N orders waiting on allocation"; empty pack queue + PICKING count → "N orders currently being picked." **Quick-action shortcuts** on staff dashboard above KPIs: Create order / Receive shipment / Manage clients / Manage warehouses. **Form polish**: `*` required markers + `autoFocus` on first input in the top dialogs. **HelpTerm primitive** for inline jargon tooltips (available, sparing use). 11 new integration tests cover seed/reset/RLS isolation + activity event derivation. Inspirations called out: Stripe (sandbox + activity feed + error pages), Shopify (welcome banner + setup checklist), Linear (workflow-grouped sidebar), Notion (help drawer pattern), ShipBob/ShipHero (role-aware landings + three-pane order detail). Out of scope (Tier 3, deferred): kanban drag/drop board, ⌘K search, keyboard shortcuts, mobile card tables, Clerk auth theming, multi-warehouse switcher, real Settings page, notifications/inbox. |

| 2026-05-18 | Final polish before Phase 2 (Milestone 1.14) | Closes the polish work before billing lands. No schema, no migration. **Tactile interaction system** — `<Card>` gains a `hoverable` prop that adds `transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-md hover:border-foreground/15 cursor-pointer`; `<Button>` gets baseline `active:scale-[0.98]` press feedback across all variants; sidebar nav items gain a prominent left-border accent on the active route via a `before:` pseudo-element. Applied universally to KPI StatCards, needs-attention rows, recent-orders rows, welcome-dialog choice cards, onboarding checklist rows. **StatCard redesign** — bigger numeric value (`text-4xl tabular-nums`), label-above + icon-right layout, hover-lift via the new Card prop. **Verbosity trim** — every page-help drawer entry shortened ~40%; landing page hero / how-it-works / feature copy tightened; welcome dialog drops the "I'll decide later" link; demo banner one-sentence. **Dashboard reorder + tighten** — KPIs surface first, onboarding checklist only renders when not complete, "Need a refresher" line removed, all H2 section labels demoted to `text-xs`. **Catalog flow streamlining** (Shopify pattern) — `CreateProductDialog` accepts `onCreatedHref` callback; after create, navigates to product detail with `?addSku=1` query and `CreateSkuDialog` auto-opens via `defaultOpen` prop. The success toast on SKU create includes an "Add another" action that re-opens the dialog with a fresh form — zero clicks to add a second SKU. **Loading skeletons** mirror the actual page layout (KPI strip, quick-actions row, two-column needs-attention + today) so the swap-in feels seamless rather than a jarring shape change. **Phase 0-1 end-to-end test** (`tests/integration/phase-1-e2e.test.ts`) walks the entire manual fulfillment loop through every service layer in one test: company auto-provision → warehouse + zone + aisle + bins → client + portal invite → product + SKU → personalization field → notify inbound → start receiving → receive line → complete → assert StockLevel materialized → create order via portal context with personalization → assert auto-allocation moved order to READY_TO_PICK + RESERVED stock decremented → pick → pack → ship → invite staff → verify activity feed has all 5 events + productivity counts updated. Proves the loop composes coherently end-to-end, not just per-milestone in isolation. **238 tests total** (237 existing + 1 new e2e). Inspirations: Linear (universal hover-lift, snappy transitions, prominent active route), Stripe Dashboard (bigger KPI numbers, hover-elevates), Vercel (small/bold typography, tactile feedback), Resend (micro-interactions on every clickable surface), Shopify (auto-open SKU dialog after product create). Out of scope (deferred to Phase 5+): real Settings page, kanban drag/drop, ⌘K search, mobile card layouts, Clerk auth theming, sparklines/historical KPIs (needs Phase 2 billing-ledger time series), notifications. |

> Append to this log whenever a decision changes. Never edit history — add a new row.
