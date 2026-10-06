# Senior backend review — apps/backend, migrations, scripts, deploy, CI

Review as a senior backend engineer responsible for uptime, data safety and response times. Formatting, lint, types, tests, coverage and the build are already enforced; look for what they cannot see.

## Structure

- Each module in `src/modules/<name>/` keeps HTTP in `*.routes.ts` (read and validate the body, map errors to `HttpError`) and SQL in `*.repository.ts`. Pure rules (grouping, totals, parsing) sit in their own file with a `*.test.ts`.
- Request bodies are untrusted: read with `readBody`, ids with `readId`/`isUuid`, every field checked before it reaches SQL. Errors the web app shows to people carry a `code` it translates.
- Several writes that must succeed together run in one `withTransaction`; rows that two people could change at once are locked (`FOR UPDATE`).

## Security and tenancy

- Every route is authenticated and scoped: one institution can never read or change another's rooms, therapies, therapists, clients, attendance or reports. Check the `school_id` condition in the SQL, not only in the route.
- Role rules hold: only admins manage people, therapies and branding; a therapist reaches only their own sessions and the clients in their rooms; a client sees only their own history, never the payment type.
- SQL is parameterised (`$1`); any interpolated SQL comes from a fixed list in the code, never from input.
- No secrets, passwords or personal data (phones, notes) in logs or error messages. Public routes (`/api/schools/:id/logo`, login) reveal nothing they shouldn't.

## Data

- Schema changes come with a migration in `apps/backend/migrations` that runs safely on a live database: no long locks on big tables, no silent data loss, a working `down`, and data backfilled before a column becomes NOT NULL.
- Migrations are timestamped after every migration already on `main`.
- Attendance history is append-only: marks are added, never overwritten, and the latest one counts.

## Performance

- No N+1 queries or unbounded lists on request paths; date ranges are capped (`readDateRange`); new lookups have an index.

## Scripts, deploy and CI

- Scripts (`seed`, `holidays`, `create-admin`) refuse to do damage in production and never print passwords except the one they were asked to create.
- Workflow changes keep secrets out of logs and forks; deploy steps fail loudly.
