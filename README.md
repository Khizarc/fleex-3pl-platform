# Fleex 3PL Platform

A multi-tenant 3PL (third-party logistics) warehouse and shipping platform — Next.js + TypeScript + PostgreSQL + Prisma. Four interlocking systems: a multi-tenant backbone, two front-end apps (Warehouse Dashboard + Client Portal) sharing one backend, a workflow/state engine, and an integration layer (Shopify, Amazon, WooCommerce, EasyPost, QuickBooks, Stripe).

> **Status:** Planning phase. No application code exists yet. The docs in this repo are the spec; Phase 0 scaffolding is the next milestone.

---

## Read these in order before any code

1. **[docs/BUILD-PLAN.md](docs/BUILD-PLAN.md)** — the *why* and the phased roadmap. Sections 1–4 set context; Section 7 is the execution plan.
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — stack decisions, multi-tenancy strategy, data model, state machines, folder layout.
3. **[CLAUDE.md](CLAUDE.md)** — standing instructions for working on this project. Non-negotiable rules (tenant isolation, state transitions, billing, audit) and conventions.

---

## Repository layout

```
.
├── README.md             ← this file
├── CLAUDE.md             ← rules for every working session (read every time)
├── docs/
│   ├── BUILD-PLAN.md                ← phased execution plan
│   ├── ARCHITECTURE.md              ← stack, data model, state machines, code organization
│   ├── 3PL-Platform-Overview.md     ← stakeholder-facing overview
│   ├── 3PL-Platform-Overview.pdf    ← PDF version of the same
│   └── diagrams/                    ← 6 architecture diagrams + their README
└── prisma/
    └── schema.prisma     ← Phase 0 core tenancy schema (Company, User, Client, ClientUser)
```

---

## Stack at a glance

Next.js (TypeScript, strict) · PostgreSQL on Neon · Prisma · Clerk auth · Stripe payments · EasyPost carriers · Upstash QStash background jobs · Vercel hosting. Full reasoning in [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md).

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
