# `components`

**Single responsibility:** shared, presentational UI only.

**Non-negotiable rule (`CLAUDE.md`, `docs/ARCHITECTURE.md` §6):** components never run raw database queries and never hold business logic. Database access is in `lib/db`; business logic is in `features/<domain>`. A component takes props and renders.
