# Fleex 3PL Platform — Internal Build Plan

> **Audience:** The developer(s) building this, and Claude Code.
> **Not for the client.** This is the technical execution document. It will change as reality is hit — that is expected and healthy.
> **Source of truth:** Derived from the Fleex LLC "3PL Warehouse & Shipping Platform" proposal. Where the proposal is a marketing document organized by *benefit*, this plan reorganizes everything into *dependency-ordered technical work*.

---

## 0. How to use this document

1. Read Sections 1–4 fully before writing any code. They are the "why" and the "shape."
2. Section 5 (Data Model) and Section 6 (State Machines) are the spine of the app. Get them right on paper first.
3. Section 7 is the phased roadmap — this is what you execute against, milestone by milestone.
4. Section 8 onward covers cross-cutting concerns (security, testing, integrations, risks) that apply to *every* phase.
5. Keep this file in the repo root. Update it when decisions change. Stale plans are worse than no plan.

**Working rule with Claude Code:** never ask it to "build the proposal." Give it one milestone (Section 7) at a time, make it produce a plan before code, review the plan, then approve. See Section 11.

---

## 1. What this product actually is

Stripped of marketing language, this is **four interlocking systems**:

| System | Plain description |
|---|---|
| **Multi-tenant backbone** | Many 3PL companies, each with many of their own clients, each with strictly isolated data. Everything else sits on top of this. |
| **Two front-end apps, one backend** | The **Warehouse Dashboard** (3PL staff) and the **Client Portal** (the 3PL's customers). Different users, permissions, and screens — shared database and business logic. |
| **A workflow / state engine** | Physical objects move through states: inventory (received → stored → picked → packed → shipped → delivered), orders, and returns. Most of the app is "advance an object to its next legal state and record who/when." |
| **Integration layer** | External systems — Shopify, Amazon, WooCommerce, shipping carriers, QuickBooks, a payment processor. Each is its own mini-project with its own credentials, failure modes, and approval process. |

**One-sentence mental model:** *A state machine for physical objects, wrapped in a multi-tenant permission system, with two front doors and several external pipes.*

If a feature ever feels confusing, map it back to one of these four. It is always one of them.

---

## 2. Core architectural principles

These are non-negotiable and apply everywhere.

1. **Tenant isolation is a database-level guarantee, not a UI behavior.** Hiding data in the front end is not isolation. See Section 4 and Section 8.
2. **Build in vertical slices.** One feature, end to end (DB → API → UI → test), then the next. Never "all the models, then all the endpoints." You should always have something that runs.
3. **State transitions are explicit and validated.** An order cannot jump from `received` to `delivered`. Illegal transitions are rejected at the service layer. See Section 6.
4. **Money and external systems are treated as dangerous.** Billing, payments, and carrier/marketplace APIs get extra validation, logging, and idempotency. Assume they will fail mid-operation.
5. **Every billable event is logged when it happens, not recalculated later.** Invoicing reads an append-only ledger; it never re-derives history.
6. **Audit everything that matters.** Who received this stock? Who shipped this order? Who changed this price? A 3PL lives or dies on accountability.
7. **The codebase stays small-file, single-responsibility, and modular.** No thousand-line files. No file doing five jobs. This is a non-negotiable principle, not a style preference — see Section 3a for the full rationale and rules. An app this size only stays maintainable if it is broken into small, focused pieces from day one.

---

## 3. Tech stack (decided)

> This is the **chosen stack for the project**, not a menu. The reasoning is recorded so the decision is understood, not so it gets relitigated. If a choice is ever genuinely overridden, update this section *and* check the rest of the doc for knock-on effects. The few items still genuinely open are in Section 12 — and they are configuration choices *within* this stack, not the stack itself.

**The stack in one line:** Next.js (TypeScript, strict mode) + PostgreSQL + Prisma, deployed on managed infrastructure.

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **Next.js + TypeScript (strict mode)** | The Warehouse Dashboard and Client Portal share one backend. A single full-stack framework means one repo, one mental model, one deployment — no cross-repo API contract to maintain by hand. TypeScript in `strict` mode from the first commit is the single biggest bug-prevention lever in the project: types flow from the database row through the API into the UI, so breaking changes surface at compile time, not in production. It is also the stack Claude Code is most fluent in, which is a real efficiency multiplier given Claude Code is the build tool. |
| **Database** | **PostgreSQL** | The domain is deeply relational (companies → clients → warehouses → bins → inventory → orders → billable events). This is a textbook relational database, not a "maybe NoSQL" situation. Postgres also provides **Row-Level Security**, which the entire multi-tenancy isolation strategy depends on (Section 4). |
| **ORM** | **Prisma** | The schema *is* the app's spine. Prisma keeps it version-controlled, typed, and migration-driven, and its generated types flow into the API and UI for free — extending the end-to-end type safety down to the database. |
| **Language discipline** | **TypeScript `strict`, enabled in Phase 0** | Added later means retrofitting types onto code not designed for them. Strict from the empty repo, no exceptions. |
| **Auth** | A managed provider (Clerk or Auth0) | Do not hand-roll auth — especially with the two-level company/client tenancy. Must support roles and the tenant structure. **Provider choice is a Section 12 decision point, but "managed, not hand-rolled" is decided.** |
| **Background jobs** | A queue (BullMQ + Redis, or a managed equivalent) | Marketplace syncs, batch label printing, scheduled reports, and auto-billing must run outside the request cycle. Self-hosted vs. managed is a Section 12 decision point. |
| **Payments** | **Stripe** | The "auto-collect payment at a balance threshold" feature means handling real money. Stripe holds card data so the platform stays out of PCI scope. Hard requirement, not a preference. |
| **File storage** | S3-compatible object storage | Personalization artwork, damage photos, packing slips, invoice PDFs. Never stored on the app server. |
| **Hosting** | Managed platform (e.g. Vercel for the app + managed Postgres + managed Redis) | Keeps effort on the product, not ops. Specifics are a Section 12 decision point; "managed" is the decided direction. |
| **Tooling** | ESLint + Prettier + pre-commit hook + CI, all set up in Phase 0 | Not optional and not "later." This is the enforcement layer that keeps the codebase clean and bug-free automatically. See Section 3a. |

### Why this stack specifically fits *this* app

Three properties of this app point cleanly at this stack:

- **Two front-ends, one backend** → one full-stack framework (Next.js) beats a split frontend/API, which would add a hand-maintained contract for no payoff at this scale.
- **Deeply relational + multi-tenant** → PostgreSQL with RLS is the natural fit; the isolation strategy is built on it.
- **Money + external integrations everywhere** → end-to-end TypeScript means Stripe payloads, carrier responses, and marketplace order shapes are typed, so mismatches are caught at compile time instead of in production.

The build tool (Claude Code) being strongest in this stack is the final practical tiebreaker.

---

## 3a. Keeping the codebase clean (a first-class requirement)

**This is not a style preference. It is a core requirement of the project, with the same weight as tenant isolation.** An app of this scope — four interlocking systems, two front-ends, a billing engine, a dozen integrations — only stays buildable if it is kept clean from the first commit. A messy codebase on a project this size does not just slow you down; it eventually stops you, because nobody (you or Claude Code) can safely change anything.

### Why this matters so much here

- **The domain is large.** There is no version of this app that is "a few files." If it is not deliberately broken up, it becomes thousands of lines of tangled logic that no one can reason about.
- **Claude Code is the build tool.** Claude Code works far better on small, focused files with clear responsibilities. A 2,000-line file is hard for it to edit safely — it loses track of context, makes changes that break distant parts of the same file, and produces plausible-but-wrong code. Small files keep Claude Code accurate. **Clean code is not just nice-to-have here — it is what makes the build tool reliable.**
- **Bugs hide in big files.** A function buried in a giant file, doing three things, touched by five features, is where bugs live and where they are hardest to find. Small single-responsibility units make bugs shallow and obvious.
- **Vertical slices depend on it.** The "build one feature end to end" principle (Section 2) only works if features are cleanly separated. Tangled code makes slices impossible.

### The rules

These are enforced — by review, by linting where possible, and by standing instruction to Claude Code (Section 11).

1. **No giant files.** A file approaching a few hundred lines is a signal to split it. There is no hard universal number, but "thousands of lines in one file" is always wrong. If a file is big, it is doing too much — break it apart by responsibility.
2. **One file, one responsibility.** A file should have a single clear job you can name in a sentence. "This handles order state transitions." "This is the pick-queue API route." If describing it needs the word "and" several times, split it.
3. **Small functions.** A function should do one thing. Long functions with many branches get decomposed into named helpers — the names themselves become documentation.
4. **Feature-oriented folder structure.** Organize by feature/domain (receiving, inventory, orders, billing, shipping…), not by lumping every route in one folder and every component in another. Related code lives together.
5. **Clear layer separation.** Database access, business logic (services), API routes, and UI components are distinct layers in distinct files. A React component does not contain raw database queries. An API route does not contain a hundred lines of business logic — it calls a service.
6. **Shared logic is extracted, not copy-pasted.** Pricing math, state-transition validation, tenant-context helpers — written once, in one place, imported everywhere. Duplication is a bug waiting to happen in only some of the copies.
7. **Name things honestly.** A file, function, or variable's name should tell the truth about what it does. Misleading names are worse than no names.
8. **Refactor as you go, not "later."** When a file starts getting big or a function starts doing too much, split it *then* — as part of the milestone. "Clean it up later" never happens, and the mess compounds.

### How this is enforced

- **`CLAUDE.md` carries these as standing instructions** so every Claude Code session follows them (Section 11).
- **Code review** (even self-review) explicitly checks file size and single-responsibility, not just "does it work."
- **The plan-before-code loop** (Section 11) is where structure gets decided — when Claude Code plans a milestone, the plan should already show *which files* will be created and what each is responsible for. Structure is reviewed before code exists.
- **When a file gets too big mid-build, splitting it is part of the current milestone**, not a deferred task.

---

## 4. Multi-tenancy: the most important decision in the project

There are three common strategies. This plan recommends a **hybrid**.

| Strategy | How it works | Pros | Cons |
|---|---|---|---|
| `tenant_id` column only | Every table carries a tenant ID; every query filters on it | Simple, cheap | One forgotten `WHERE` = silent cross-tenant data leak. Relies on perfect discipline forever. |
| Postgres Row-Level Security (RLS) | DB policies enforce that a session can only see its tenant's rows | Isolation enforced by the database; app-code mistakes can't leak data | More setup; must set the tenant context per request |
| Schema-per-tenant / DB-per-tenant | Each tenant gets its own schema or database | Strongest isolation | Migrations and cross-tenant ops (e.g. platform analytics) get painful; scales awkwardly past a few dozen tenants |

**Recommendation: `tenant_id` on every table _plus_ Row-Level Security.**

- The `tenant_id` column makes ownership explicit and queries efficient.
- RLS makes isolation a guarantee enforced by Postgres itself — a missing filter in app code cannot leak data.
- Every request sets the tenant context (the current company, and where relevant the current client) before any query runs. This is middleware, written once, tested hard.

**Two levels of tenancy.** Note this carefully — it is not one level:
- **Company** = the 3PL business using the platform (the paying customer).
- **Client** = that 3PL's own customer, who logs into the Client Portal.

A company's staff can see all of that company's clients. A client can see **only their own** data — never another client's, never the company's internal operations. Both boundaries must be enforced.

---

## 5. Data model (the spine — design before coding)

This is the initial entity map. Build it out fully in Prisma schema before writing features. Every table except the top-level `Company` carries `tenant_id` (the owning company) and is covered by RLS.

### Core tenancy & identity
- **Company** — the 3PL business. Branding fields (logo, name, colors) for white-labeling. Billing settings.
- **User** — belongs to a Company. Has a **Role** (admin, picker, packer, shipper, receiver — extend as needed). May be assigned to specific warehouse locations.
- **Client** — a customer of the Company. Has its own portal login(s). Has custom pricing overrides and customizable personalization field definitions.
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
- **Order** — belongs to a Client. Shipping address, status (see Section 6), source (manual, CSV, Shopify, Amazon…).
- **OrderLineItem** — a SKU + quantity on an Order.
- **PersonalizationDetail** — custom fields attached to an order or line item (text, selections, file uploads, instructions). Field definitions are per-Client.
- **PickTask / PackTask** — work assigned to staff; links Order to Bin locations and the assigned User.
- **Shipment** — carrier, service, label, tracking number, cost. Linked to an Order.

### Returns
- **ReturnRequest** — initiated by a Client from the portal.
- **ReturnInspection** — graded outcome: `restock`, `quarantine`, `dispose`.

### Billing
- **PricingRule** — a Company's rate for a service (per order, pick fee, pack fee, box size, storage, receiving, label markup, returns, special handling, minimums). Supports **per-Client overrides**.
- **BillableEvent** — append-only ledger row: event type, quantity, the PricingRule applied, computed amount, timestamp, related entity. *Written when the event happens.*
- **Invoice** — generated from BillableEvents for a Client over a period; line items, totals, status.
- **Payment** — a collection attempt/result against an Invoice or balance (Stripe).

### Integrations & audit
- **Integration** — a connected external account (Shopify store, Amazon seller, QuickBooks, carrier) belonging to a Company or Client. Stores credentials/tokens **encrypted**.
- **SyncLog** — record of each sync run: what, when, success/failure, errors.
- **AuditLog** — append-only: actor, action, entity, before/after, timestamp. Cross-cutting.
- **Notification** — tracking updates, alerts, status emails sent under the Company's brand.

> Treat this list as the **starting point**. Expect to discover missing entities (e.g. kitting/bundles, cycle-count sessions) during Phase 2–3. Add them deliberately, with a migration, and update this section.

---

## 6. State machines (write these out fully before coding the workflow)

Most bugs in this kind of app are **illegal state transitions**. Define every status and every legal transition. The service layer rejects anything not on the list.

### Order status
```
draft → submitted → awaiting_stock(optional) → ready_to_pick → picking
→ picked → packing → packed → ready_to_ship → shipped → in_transit
→ delivered
```
Plus side states reachable from defined points: `on_hold`, `cancelled`, `exception`, `partially_shipped`. Define exactly which states can enter `on_hold` / `cancelled`.

### Inventory item status
```
inbound_expected → received → available
available → reserved (when allocated to an order)
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

For each machine: document **who** can trigger each transition (which role / client) and **what side effects** fire (e.g. `picked → packed` may free a reservation; `shipped` triggers a tracking notification and a BillableEvent).

---

## 7. Phased roadmap (the execution plan)

Each phase ends with something **demonstrable and usable**. The proposal's own "pilot program" framing assumes phased delivery — use that.

> **Rule:** do not start a phase until the previous phase's "Definition of done" is met, *including its tenant-isolation tests.*

### Phase 0 — Foundations *(no visible features yet — this is the platform)*
- Repo, TypeScript in **`strict` mode**, environments (dev/staging/prod).
- **Clean-code enforcement layer set up now, not later:** ESLint + Prettier + a pre-commit hook + CI running typecheck/lint/tests on every push. Feature-oriented folder structure established (Section 3a).
- Prisma schema for **core tenancy entities only**: Company, User, Role, Client, ClientUser.
- **Multi-tenancy implemented and proven**: `tenant_id` everywhere, RLS policies, the per-request tenant-context middleware.
- Auth wired in: company-staff login and client login as distinct flows; role-based access.
- The two app shells: Warehouse Dashboard and Client Portal, each behind correct auth, each showing a placeholder home screen.
- The planning docs in the repo: this file, `ARCHITECTURE.md`, `CLAUDE.md` (Section 11).
- **Definition of done:** a company admin can log in and create a client; a client user can log in and see only an empty portal; an automated test proves Client A cannot read Client B's data via the API; lint, typecheck, and CI are green and enforced.

### Phase 1 — The core fulfillment loop *(manual only — no integrations)*
This is the heart of the product and the first thing worth demoing.
- Warehouse structure: create warehouses, zones, aisles, bins.
- Products/SKUs (created per client).
- Receiving: inbound shipment notices → scan/verify check-in → assign to bins → discrepancy & damage photos.
- Inventory views: real-time stock by bin/warehouse; available vs reserved vs on-hold.
- Orders: **manual entry and CSV bulk upload only.** No marketplace sync yet.
- Personalization fields: per-client custom field definitions; values captured on orders; visible on the pack screen.
- Pick / pack / ship workflow: pick queue, scan-to-confirm, pack screen with personalization, manual label entry (clients "upload their own label" — carrier purchasing comes later).
- Order + inventory state machines enforced (Section 6).
- Team management: assign tasks to staff, role-based access, basic productivity tracking.
- **Definition of done:** a full order can travel manual-entry → picked → packed → shipped entirely in-app, across at least two warehouses, with personalization details surfacing correctly, and isolation tests still green.

### Phase 2 — Billing & money
- PricingRule engine: every rate type in the proposal, plus per-client overrides.
- BillableEvent ledger: events written automatically as picks/packs/labels/storage-days/receiving/returns happen.
- Invoicing: one-click generation from the ledger, full line-item breakdown, PDF export.
- Stripe integration: store payment methods, charge on a balance threshold, record Payments.
- Client portal: clients view their charges and invoices.
- **Definition of done:** a month of activity produces a correct, itemized invoice; a threshold breach triggers a real (test-mode) Stripe charge; numbers reconcile against the ledger.

### Phase 3 — Shipping engine
- Carrier integrations: live rate comparison across major carriers, label purchase, address validation, tracking-number retrieval.
- Batch processing: many shipments in one operation (background job).
- Automatic tracking notifications to clients and their customers, under the company's brand.
- Shipping label markup feeds the billing ledger.
- **Definition of done:** a real (sandbox) label can be purchased, the best rate is selectable, a bad address is caught pre-ship, and tracking flows to the portal automatically.

### Phase 4 — Marketplace integrations
- Shopify first (best-documented): order pull-in, tracking push-back, no client-account access.
- Then Amazon, then WooCommerce. **Each is its own milestone** — do not batch them.
- SyncLog + robust failure handling and retries.
- **Definition of done (per marketplace):** orders flow in automatically and tracking flows back, with sync failures logged and recoverable.

### Phase 5 — Client portal polish, white-labeling, analytics
- White-labeling: company logo/name/branding on the portal, packing slips, tracking pages, emails. Platform is invisible to clients.
- Returns: full client-initiated return flow + inspection/grading.
- Analytics: warehouse-side operational metrics; client-side unified cross-marketplace analytics.
- QuickBooks integration.
- CSV/PDF exports and scheduled email reports.
- **Definition of done:** a client sees a fully branded experience with no Fleex/platform references, can self-serve returns, and views analytics across their connected marketplaces.

### Phase 6 — Hardening before real clients touch it
- Security review (Section 8), load testing, backups + restore drill, monitoring/alerting, error tracking.
- Documentation and onboarding flow for the pilot.
- **Definition of done:** staging survives a realistic load test; a backup has been restored successfully; monitoring is live.

> **Phase boundaries are commitments.** "Manual orders, no integrations" is a clean line. "Some of Shopify" is not. Keep the lines clean.

---

## 8. Security & data protection (cross-cutting — applies to every phase)

- **Tenant isolation tests run in CI.** Every phase adds tests proving no cross-company and no cross-client access. A failure here blocks the build.
- **Auth:** never hand-rolled. Strong password policy or SSO; secure session handling; enforced role checks on every endpoint (not just hidden UI).
- **Secrets & credentials:** marketplace tokens, carrier keys, QuickBooks tokens stored **encrypted at rest**. Never in the repo. Environment-based config.
- **Payments:** Stripe holds card data — never store raw card numbers. All money operations are **idempotent** (a retried charge must not double-bill) and logged.
- **Audit log:** every sensitive action (receiving, shipping, price changes, payments, permission changes) is recorded immutably.
- **File uploads:** validate type/size; scan personalization artwork and photos; store in object storage, not the app server.
- **PII:** shipping addresses and contact info are personal data — access-controlled and covered by isolation.
- **Backups:** automated, with a *tested* restore procedure. Untested backups don't count.

---

## 9. Testing strategy

- **Unit:** pricing math, state-transition validation, isolation helpers.
- **Integration:** API endpoints with auth + tenant context; "can Client A reach Client B's data?" as a standing suite.
- **End-to-end:** the core flows — receive → store → order → pick → pack → ship; generate invoice; process return.
- **Integration sandboxes:** carriers, Stripe, Shopify, QuickBooks all have test/sandbox modes — use them; never test against live accounts or real money.
- **Seed data:** a script that creates two companies, each with multiple clients, warehouses, and stock — so isolation is testable from day one.

---

## 10. External dependencies & what must come from the business

These are **blockers you do not control** — surface them to the business early; the build cannot complete without them.

| Dependency | Needed for | Who provides |
|---|---|---|
| Stripe account | Phase 2 billing/payments | Business (it's their money) |
| Carrier accounts / API access (e.g. EasyPost/Shippo or direct) | Phase 3 shipping | Business |
| Shopify Partner/dev credentials | Phase 4 | Business |
| Amazon Selling Partner API access (approval process — start early) | Phase 4 | Business |
| WooCommerce API keys | Phase 4 | Business / their clients |
| QuickBooks developer account | Phase 5 | Business |
| Hosting & domain decisions | Phase 0 onward | Business (cost owner) |
| Company & client branding assets | Phase 5 | Business |

> **Amazon SP-API approval can take weeks.** Request it the moment Phase 1 starts, not when Phase 4 begins.

---

## 11. Working with Claude Code (process discipline)

The failure mode is dumping the proposal in and saying "build this." It produces plausible code that collapses where pieces meet. Avoid it with these rules.

**Repo planning files (create in Phase 0, keep current):**
- `BUILD-PLAN.md` — this document.
- `ARCHITECTURE.md` — stack decisions, the data model, exactly how multi-tenancy is enforced.
- `CLAUDE.md` — instructions Claude Code reads every session: conventions, the tenancy model, "never write a query without tenant context," what not to touch, how to run tests.

**Per-milestone loop:**
1. Give Claude Code **one milestone** from Section 7 — not a phase, a milestone.
2. Ask it to **plan first**: data-model changes, API endpoints, screens, tests, **and which files will be created/changed and what each is responsible for** — *no code yet.*
3. **Review the plan.** Catch architectural mistakes here, while they're cheap — including file structure. If the plan shows one file doing too much, fix it before code exists.
4. Approve, then let it build the vertical slice (DB → API → UI → tests).
5. Run the suite, **especially the isolation tests.** Cross-tenant leak → stop everything, fix before moving on.
6. Check file size and single-responsibility before considering the milestone done. A file that grew too big gets split *as part of this milestone*, not later.
7. Update this file and `ARCHITECTURE.md` if anything changed.

**Standing instructions to put in `CLAUDE.md`:**
- Every query runs within tenant context — no exceptions.
- New tables get `tenant_id` + an RLS policy in the same migration.
- State changes go through the validated transition layer, never direct status writes.
- Billable events are written at event time, appended to the ledger, never recalculated.
- New external-facing actions get an audit-log entry.
- **Keep files small and single-responsibility — see Section 3a.** No thousand-line files. One file, one job. If a file is getting big, split it by responsibility now, not later.
- **Separate the layers:** database access, services (business logic), API routes, and UI components live in distinct files. Components don't run raw queries; routes don't hold business logic.
- **Organize by feature/domain** (receiving, inventory, orders, billing, shipping), not by dumping all routes or all components together.
- **Extract shared logic** (pricing math, state-transition validation, tenant helpers) into one place — never copy-paste it.
- When asked to plan a milestone, **always list the files to be created/changed and each file's single responsibility** before writing any code.

---

## 12. Open decision points (resolve deliberately, don't drift into them)

| # | Decision | Notes |
|---|---|---|
| 1 | **Auth provider** | Managed (Clerk/Auth0 — faster, handles the hard parts) vs. self-managed (Auth.js — more control, more responsibility). Must fit the company/client two-level tenancy. |
| 2 | **Hosting** | Managed platform vs. self-managed infra. Affects cost and ops burden — the business owns the cost. |
| 3 | **Background jobs** | Self-hosted (BullMQ + Redis) vs. managed queue. |
| 4 | **Carrier integration** | Aggregator (EasyPost/Shippo — one API, many carriers, faster) vs. direct carrier APIs (more control, much more work). Aggregator strongly recommended for v1. |
| 5 | **Marketplace order sync** | Webhook-driven (near real-time) vs. polling (simpler, laggier). Likely a mix per platform. |
| 6 | **Personalization file uploads** | Size limits, allowed types, virus scanning, retention policy. |
| 7 | **Invoice/billing period** | Calendar month vs. rolling vs. per-client configurable. The proposal implies configurable — confirm. |
| 8 | **"Product name pending"** | The proposal has no product name. Branding/white-label work in Phase 5 needs one. |

Resolve each one explicitly, record the decision and date in `ARCHITECTURE.md`, and update this table.

---

## 13. Known risks & how the plan addresses them

| Risk | Mitigation in this plan |
|---|---|
| Cross-tenant data leak | RLS + `tenant_id` + isolation tests in CI from Phase 0 |
| Integrations underestimated | Each marketplace is its own milestone; Phase 4 is isolated; SP-API approval requested early |
| Billing errors / double charges | Append-only ledger; idempotent payment operations; reconcile-against-ledger as definition of done |
| Scope creep across phase lines | Phase boundaries treated as commitments; "clean line" rule in Section 7 |
| Building features in the wrong order | Dependency-ordered roadmap; "previous phase done before next starts" rule |
| Claude Code producing code that doesn't fit | Plan-before-code loop; vertical slices; `CLAUDE.md` standing instructions |
| Codebase becoming an unmaintainable mess (giant files, tangled logic) | Section 3a treated as a first-class requirement; clean-code rules in `CLAUDE.md`; file size/responsibility checked every milestone; splitting done in-milestone, never deferred; linting + CI as an enforcement wall |
| External blockers stalling the build | Section 10 surfaced to the business at project start, not when each phase begins |
| Lost work / no recovery path | Backups with a *tested* restore in Phase 6 hardening |

---

## 14. Immediate next actions

1. Resolve decision points #1–#4 in Section 12 (they affect Phase 0).
2. Send Section 10 (external dependencies) to the business — start the Amazon SP-API request now.
3. Stand up the repo and the three planning files (`BUILD-PLAN.md`, `ARCHITECTURE.md`, `CLAUDE.md`).
4. Design the full Prisma schema for Section 5's core tenancy entities — on paper / in schema form, reviewed — before coding.
5. Begin Phase 0. Do not start Phase 1 until its definition of done, including the isolation test, is green.

---

*This is a living document. When reality contradicts the plan, update the plan — don't ignore it.*
