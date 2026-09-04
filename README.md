# Fleex 3PL Platform

A multi-tenant 3PL (third-party logistics) warehouse and shipping platform — Next.js + TypeScript + PostgreSQL + Prisma. Four interlocking systems: a multi-tenant backbone, two front-end apps (Warehouse Dashboard + Client Portal) sharing one backend, a workflow/state engine, and an integration layer (Shopify, Amazon, WooCommerce, EasyPost, QuickBooks, Stripe).

> **Status:** Phase 1 complete — 18 models, both applications, and the full
> receive → pick → pack → ship path are built and tested. Phase 2 (returns,
> billing and the carrier and storefront integrations) is next.

---

## Read these in order before any code

1. **[docs/BUILD-PLAN.md](docs/BUILD-PLAN.md)** — the *why* and the phased roadmap. Sections 1–4 set context; Section 7 is the execution plan.
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — stack decisions, multi-tenancy strategy, data model, state machines, folder layout.
3. **[CLAUDE.md](CLAUDE.md)** — standing instructions for working on this project. Non-negotiable rules (tenant isolation, state transitions, billing, audit) and conventions.

---

## What is built

**Two applications over one backend.** The warehouse dashboard is the operator's
view — clients, warehouses, inbound shipments, inventory, the order queue and
the fulfilment floor. The client portal is the brand's view of their own stock
and orders. Both run on the same Prisma layer, separated by row-level tenancy
rather than by duplicated code.

**Tenant isolation is enforced at two levels.** Every query is scoped by
company, and client-scoped records are scoped again by client, so a portal user
cannot reach another brand's data even through a shared endpoint.

**The fulfilment path is complete.** An order arrives (entered, or bulk-uploaded
by CSV), stock is allocated atomically FIFO against real bin locations, then it
moves `ALLOCATED → PICKED → PACKED → SHIPPED` through scan-to-confirm picking,
a pack station that records box dimensions and weight, and manual label entry.

**Per-line personalisation.** Clients define custom fields against their own
catalogue — engraving text, gift notes — which follow the line through picking
and packing.

```
.
├── app/(warehouse)/      Operator dashboard — 21 routes
├── app/(portal)/         Client portal — 12 routes
├── features/            18 domain modules: orders, inventory, inbound,
│                        fulfilment, shipping, personalization, team, …
├── prisma/schema.prisma 18 models with row-level tenancy
├── tests/ · e2e/        30 unit and Playwright suites
└── docs/                Build plan, architecture, 6 diagrams
```

---

## Stack at a glance

Next.js (TypeScript, strict) · PostgreSQL on Neon · Prisma · Clerk auth · Tailwind v4 + shadcn/ui · Stripe payments · EasyPost carriers · Upstash QStash background jobs · Vercel hosting. Full reasoning in [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md).

## Working with this project

Per [CLAUDE.md](CLAUDE.md), work happens **one milestone at a time** from [docs/BUILD-PLAN.md §7](docs/BUILD-PLAN.md). Every milestone: plan first (list files + responsibilities), get the plan approved, then build the vertical slice (DB → API → UI → tests). Never start coding a milestone before its plan is approved.

---

## Local development

**Prerequisites:** Node 20+ (Node 22 recommended; see [.nvmrc](.nvmrc)) and pnpm 11. Install pnpm via Corepack (`corepack enable && corepack prepare pnpm@latest --activate`) or the [official installer](https://pnpm.io/installation).

**Install:**

```
pnpm install
```

**Scripts:**

| Command | What it does |
|---|---|
| `pnpm dev` | Starts Next.js in development mode at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Runs the production build |
| `pnpm typecheck` | `tsc --noEmit` — full TypeScript strict check |
| `pnpm lint` | ESLint (flat config — `eslint.config.mjs`) |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check (used in CI) |
| `pnpm test` | Vitest (unit / integration) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:integration` | Vitest, integration tests only (DB-bound) |
| `pnpm e2e` | Playwright (requires `pnpm exec playwright install chromium` first) |
| `pnpm db:migrate` | Apply pending migrations to your dev DB (and re-generate client) |
| `pnpm db:migrate:deploy` | Apply migrations non-interactively (used by CI / prod) |
| `pnpm db:generate` | Regenerate Prisma client from schema |
| `pnpm db:studio` | Open Prisma Studio (DB GUI) |
| `pnpm db:reset` | Drop + re-apply all migrations (destructive — dev only) |

**Routes (Milestone 0.1 — placeholders):**

- `/` — dev-time landing
- `/warehouse` — Warehouse Dashboard placeholder
- `/portal` — Client Portal placeholder

**Pre-commit hook:** Husky runs `lint-staged` on staged files (ESLint + Prettier for code; Prettier for JSON/CSS/YAML). Hand-authored markdown is intentionally not auto-formatted — see [.prettierignore](.prettierignore).

**Environment variables:** see [.env.example](.env.example). Copy to `.env.local` for local dev. `.env` is symlinked to `.env.local` so Prisma CLI reads the same file (both are gitignored).

**Database:** Postgres on Neon. `DATABASE_URL` (pooled) is used by the app at runtime; `DIRECT_URL` (direct connection, bypasses pgBouncer) is used by `prisma migrate` for shadow DB operations. RLS is enforced via a two-role pattern — see [docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md) and the init migration in `prisma/migrations/`.

**Authentication:** Clerk handles sign-up and sign-in. Self-serve model — anyone who signs up at `/sign-up` automatically gets a new 3PL Company workspace + admin User row on first visit to `/warehouse` (see [lib/auth/current-user.ts](lib/auth/current-user.ts)). Client Portal users (`/portal`) are admin-driven; until Milestone 0.5 ships the admin invite UI, ClientUser rows are created manually via Prisma Studio. Two env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
