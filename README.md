# Fleex 3PL Platform

A multi-tenant 3PL (third-party logistics) warehouse and shipping platform — Next.js + TypeScript + PostgreSQL + Prisma. Four interlocking systems: a multi-tenant backbone, two front-end apps (Warehouse Dashboard + Client Portal) sharing one backend, a workflow/state engine, and an integration layer (Shopify, Amazon, WooCommerce, EasyPost, QuickBooks, Stripe).

> **Status:** Planning phase. No application code exists yet. The docs in this repo are the spec; Phase 0 scaffolding is the next milestone.

---

## Read these in order before any code

1. **[BUILD-PLAN.md](BUILD-PLAN.md)** — the *why* and the phased roadmap. Sections 1–4 set context; Section 7 is the execution plan.
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — stack decisions, multi-tenancy strategy, data model, state machines, folder layout.
3. **[CLAUDE.md](CLAUDE.md)** — standing instructions for working on this project. Non-negotiable rules (tenant isolation, state transitions, billing, audit) and conventions.

---

## Repository layout

```
.
├── README.md             ← this file
├── CLAUDE.md             ← rules for every working session (read every time)
├── ARCHITECTURE.md       ← stack, data model, state machines, code organization
├── BUILD-PLAN.md         ← phased execution plan
├── docs/
│   ├── 3PL-Platform-Overview.md     ← stakeholder-facing overview
│   ├── 3PL-Platform-Overview.pdf    ← PDF version of the same
│   └── diagrams/                    ← 6 architecture diagrams + their README
└── prisma/
    └── schema.prisma     ← Phase 0 core tenancy schema (Company, User, Client, ClientUser)
```

---

## Stack at a glance

Next.js (TypeScript, strict) · PostgreSQL on Neon · Prisma · Clerk auth · Stripe payments · EasyPost carriers · Upstash QStash background jobs · Vercel hosting. Full reasoning in [ARCHITECTURE.md §2](ARCHITECTURE.md).

## Working with this project

Per [CLAUDE.md](CLAUDE.md), work happens **one milestone at a time** from [BUILD-PLAN.md §7](BUILD-PLAN.md). Every milestone: plan first (list files + responsibilities), get the plan approved, then build the vertical slice (DB → API → UI → tests). Never start coding a milestone before its plan is approved.
