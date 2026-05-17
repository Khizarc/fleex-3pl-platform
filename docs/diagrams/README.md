# Diagrams — Fleex 3PL Platform

Reference diagrams for the platform. These are **conceptual** — the system as designed across `BUILD-PLAN.md`, `ARCHITECTURE.md`, `CLAUDE.md`, and `schema.prisma`. They are not a literal screen-by-screen or function-by-function map; that detail lives in the planning docs and gets concrete as each phase is built.

| File | What it shows | Pairs with |
|---|---|---|
| `01-system-overview.svg` | The four interlocking systems — actors, two front-end apps, shared backend, database, integrations | `ARCHITECTURE.md` §1 |
| `02-order-lifecycle.svg` | The six-step order flow from the proposal, showing which actor drives each step | `BUILD-PLAN.md` §1, proposal "How It Works" |
| `03-data-model.svg` | All planned entities grouped by domain, with ownership relationships | `ARCHITECTURE.md` §4, `schema.prisma` |
| `04-order-state-machine.svg` | The validated order status flow, including side states (on_hold, cancelled) | `ARCHITECTURE.md` §5 |
| `05-inventory-return-state-machines.svg` | Inventory item, inbound shipment, and return request state machines | `ARCHITECTURE.md` §5 |
| `06-phased-build-sequence.svg` | The seven build phases in dependency order | `BUILD-PLAN.md` §7 |

## How to use these

- **Before Claude Code:** read them alongside the planning docs to hold the whole system in your head.
- **During the build:** the state-machine diagrams (04, 05) are the spine of the workflow engine — refer to them whenever building a transition.
- **They will go stale:** when the data model or a state machine changes, update the diagram or it becomes misleading. Treat them like the planning docs — living, not fixed.

## Note on depth

These are split into six focused diagrams rather than one dense one on purpose — a single all-in-one diagram becomes unreadable (overlapping boxes, crossed arrows). If a particular area needs more depth than shown here (e.g. a detailed billing-flow diagram, or a Phase-1-only screen map), generate it as its own additional diagram rather than overloading an existing one.
