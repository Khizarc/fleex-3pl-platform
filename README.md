# Fleex 3PL Platform

A multi-tenant warehouse and fulfilment platform for third-party logistics. Two applications — an operator dashboard and a client portal — run over one backend, separated by row-level tenancy rather than duplicated code. An order arrives, stock is allocated FIFO against real bin locations, and it moves through picking, packing and shipping with every transition recorded.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Postgres](https://img.shields.io/badge/PostgreSQL-Prisma-336791)
![Tests](https://img.shields.io/badge/tests-227-brightgreen)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088ff)

---

## What it does

A 3PL stores and ships other companies' inventory. That makes tenancy the central
problem: one warehouse operator serves many client brands, each of which must see
its own stock and orders and nothing else — through the same endpoints, the same
database, the same code.

**The operator's view** covers clients, warehouses down to the bin, inbound
shipments and receiving, live inventory, the order queue, and the fulfilment floor.

**The client's view** covers their own products and SKUs, their inbound shipments,
their stock levels, their orders, and the custom fields they want captured per line.

**The fulfilment path is complete.** An order is entered or bulk-uploaded by CSV,
stock is allocated atomically FIFO against real bin locations, and it moves
`ALLOCATED → PICKED → PACKED → SHIPPED` through scan-to-confirm picking, a pack
station that records box dimensions and weight, and label entry.

---

## Tenancy

Isolation is enforced at two levels rather than one.

Every query is scoped by **company** — the warehouse operator. Records that belong
to a client brand are scoped again by **client**. A portal user therefore cannot
reach another brand's data even through an endpoint both of them legitimately use,
and an operator cannot reach another operator's at all.

That rule is not a convention applied by hand at each call site. It is enforced in
the data access layer, so a new query written next year inherits it.

---

## Allocation

Stock allocation is the part that has to be right.

Two pickers working the same order queue must never be handed the same physical
unit. Allocation runs inside a transaction with row locking, consuming stock FIFO
across bin locations, so concurrent allocation of the same unit is impossible
rather than unlikely.

Order lines can carry **per-line personalisation** — engraving text, gift notes,
whatever the client defines as a custom field against their own catalogue. Those
values follow the line through picking and packing so the floor sees them at the
moment they matter.

---

## Running it

```bash
git clone https://github.com/Khizarc/fleex-3pl-platform.git
cd fleex-3pl-platform
pnpm install

cp .env.example .env.local     # fill in the values described below
pnpm prisma migrate deploy
pnpm dev                       # http://localhost:3000
```

| Command | Does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm test` | Unit and integration tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright) |
| `pnpm lint` | ESLint |

### Configuration

Copy `.env.example` to `.env.local` and fill it in. **`.env.local` is gitignored and
no real credential belongs in this repository** — `.env.example` documents every
variable with placeholder values only.

| Variable | For |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection used at runtime |
| `DIRECT_URL` | Direct connection, used by Prisma for migrations |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication, client side |
| `CLERK_SECRET_KEY` | Clerk authentication, server side |

Any Postgres 16 instance works; the project is developed against Neon.

---

## Testing

**227 tests across 28 files**, in two layers.

Unit and integration tests run against a real Postgres instance rather than mocks,
because the behaviour worth testing here — transactional allocation, row locking,
tenant scoping — only exists at the database boundary. A mock would confirm the
code calls Prisma, not that two pickers cannot take the same unit.

End-to-end tests drive the browser through the full path: receive stock, create an
order, allocate, pick, pack, ship.

CI runs the whole suite on every push against a Postgres 16 service container.

---

## Layout

```
.
├── app/(warehouse)/     Operator dashboard — 21 routes
├── app/(portal)/        Client portal — 12 routes
├── features/            18 domain modules: orders, inventory, inbound,
│                        fulfilment, shipping, personalisation, team, …
├── lib/                 Data access, tenancy scoping, shared utilities
├── prisma/schema.prisma 18 models
├── tests/               Unit and integration (Vitest)
├── e2e/                 End-to-end (Playwright)
└── docs/                Build plan, architecture, six diagrams
```

Domain logic lives in `features/`, not in route handlers. A route composes; it does
not decide. That keeps the same allocation logic reachable from the operator
dashboard, the client portal, and the CSV importer without being written three times.

---

## Status

**Phase 1 is complete** — tenancy, warehouses, products and SKUs, inbound
shipments and receiving, inventory, orders, allocation, personalisation, and the
full pick → pack → ship path, delivered across 14 milestones.

**Phase 2** is returns, billing, and the integration layer: Shopify, Amazon and
WooCommerce for order intake, EasyPost for labels, QuickBooks and Stripe for
billing.

Design decisions and the phased plan are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/BUILD-PLAN.md](docs/BUILD-PLAN.md).

---

## License

MIT — see [LICENSE](LICENSE).
