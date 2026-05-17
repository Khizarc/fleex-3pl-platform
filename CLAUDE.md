# CLAUDE.md — Standing Instructions

> Claude Code reads this file every session. It defines how to work on this project: the rules that always apply, the conventions, and the things never to do.
> **Companion documents:** `BUILD-PLAN.md` (the phased roadmap and full rationale) and `ARCHITECTURE.md` (stack decisions, data model, state machines). Read both before starting.

---

## What this project is

A multi-tenant 3PL warehouse and shipping platform. Four interlocking systems: a multi-tenant backbone, two front-end apps (Warehouse Dashboard + Client Portal) sharing one backend, a workflow/state engine, and an integration layer (Shopify, Amazon, WooCommerce, EasyPost, QuickBooks, Stripe).

**Stack:** Next.js + TypeScript (strict) + PostgreSQL (Neon) + Prisma. Auth via Clerk. Background jobs via Upstash QStash. Payments via Stripe. Carriers via EasyPost. Hosted on Vercel. Full reasoning is in `ARCHITECTURE.md`.

---

## How we work — the per-milestone loop

Work happens **one milestone at a time** (milestones are defined in `BUILD-PLAN.md` §7). For every milestone:

1. **Plan before code.** First produce a plan: data-model changes, API endpoints, screens, tests — **and the list of files to be created or changed, with each file's single responsibility stated.** No code yet.
2. **Wait for the plan to be reviewed and approved.** Do not start coding until then.
3. **Build the vertical slice** — database → API → UI → tests — for that one milestone only. Don't build ahead.
4. **Run the full test suite**, especially the tenant-isolation tests.
5. **Check file size and single-responsibility** before calling the milestone done. If a file grew too big, split it now — as part of this milestone, not later.
6. **Flag anything** that contradicts `BUILD-PLAN.md` or `ARCHITECTURE.md` so those documents can be updated.

Never try to build a whole phase, and never build the whole proposal at once.

---

## Non-negotiable rules

These always apply. If a request conflicts with one of these, stop and raise it rather than violating it.

### Tenant isolation
- **Every query runs within tenant context.** No exceptions. Never write a query that isn't scoped to the current tenant.
- **New tables get `tenant_id` + an RLS policy in the same migration** — never as a follow-up.
- Tenant isolation is a database-level guarantee (RLS), not a UI behavior. Hiding data in the front end is not isolation.
- There are **two levels** of tenancy: Company (the 3PL) and Client (the 3PL's customer). Company staff see all their clients; a client sees only their own data. Enforce both.
- Any cross-tenant data access is a critical bug — stop everything and fix it.

### State management
- State changes go through the **validated transition layer**, never direct status writes.
- Illegal state transitions are rejected at the service layer. Refer to the state machines in `ARCHITECTURE.md` §5.

### Billing & money
- **Billable events are written at event time**, appended to the ledger — never recalculated later. Invoicing reads the ledger; it never re-derives history.
- All payment operations are **idempotent** — a retried charge must never double-bill.
- Never store raw card numbers. Stripe holds card data.

### Audit
- Every sensitive action (receiving, shipping, price changes, payments, permission changes) gets an **audit-log entry**.

### Security
- Never hand-roll auth — use Clerk.
- Secrets never go in the repo. Environment variables only. Update `.env.example` when a new variable is introduced.
- Role checks are enforced on every endpoint — not just hidden in the UI.

---

## Code organization — keep the codebase clean

This carries the same weight as tenant isolation. Full rationale in `BUILD-PLAN.md` §3a.

- **No giant files.** A file approaching a few hundred lines is a signal to split it. "Thousands of lines in one file" is always wrong — if a file is big, it's doing too much.
- **One file, one responsibility** — describable in a single sentence without needing "and" several times.
- **Small functions** — one job each. Decompose long branchy functions into named helpers.
- **Feature-oriented folders** — organize by domain (receiving, inventory, orders, billing, shipping), not by lumping all routes or all components together. See the folder structure in `ARCHITECTURE.md` §6.
- **Separate the layers** — database access, services (business logic), API routes, and UI components live in distinct files. A component never runs raw queries. An API route never holds business logic — it calls a service.
- **Extract shared logic** — pricing math, state-transition validation, tenant helpers — written once, imported everywhere. Never copy-paste.
- **Name things honestly** — a file/function/variable name should tell the truth about what it does.
- **Refactor as you go** — when a file gets too big mid-build, split it then, as part of the current milestone. Never "clean it up later."
- When planning a milestone, **always list the files and each file's single responsibility** before writing code.

---

## Conventions

- **TypeScript `strict` mode** — always. No `any` to dodge a type error; fix the type.
- **Prisma** for all database access. Schema changes go through migrations.
- **Tests** accompany every milestone — unit (pricing math, state transitions, isolation helpers), integration (endpoints with auth + tenant context), and the standing isolation suite.
- **Lint and format** must pass before code is considered done — ESLint + Prettier are enforced via pre-commit hook and CI.
- **Vertical slices** — build one feature end to end, never "all the models, then all the endpoints."

---

## Things to never do

- Never write a database query outside tenant context.
- Never add a table without `tenant_id` + an RLS policy in the same migration.
- Never write a status change directly — go through the transition layer.
- Never recalculate billing from history — read the append-only ledger.
- Never commit secrets or credentials.
- Never hand-roll auth.
- Never let a file grow into thousands of lines — split by responsibility.
- Never build ahead of the current milestone.
- Never start coding a milestone before its plan is approved.

---

## When unsure

If a request is ambiguous, conflicts with `BUILD-PLAN.md` / `ARCHITECTURE.md`, or would require breaking a non-negotiable rule — **stop and ask** rather than guessing. A clarifying question is cheap; a wrong architectural decision is expensive.
