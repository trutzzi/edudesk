# EduDesk

School management for admins, teachers, students and parents.

- `apps/web` – Next.js frontend
- `apps/backend` – Express API + PostgreSQL

## Getting started

You need Node 20+ and a running PostgreSQL.

```bash
npm install && npm run install:all
cp apps/backend/.env.example apps/backend/.env   # fill in DATABASE_URL and JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run start:local
```

The app runs on http://localhost:3000 and the API on http://localhost:4000.

## Deploying

- Keep secrets in the host's environment settings, never in the repository. Only the `.env.example`
  templates are committed; `.env` and `.env.local` are ignored.
- Set `NODE_ENV=production` for the API. It then refuses to start unless `JWT_SECRET` (at least 32
  random characters, e.g. `openssl rand -hex 32`), `DATABASE_URL`, `CORS_ORIGIN`, `APP_URL` and
  `SMTP_URL` are set.
- Serve both apps over HTTPS, set `CORS_ORIGIN` to the web app's exact origin, and `TRUST_PROXY=1`
  behind a single reverse proxy.
- Use `?sslmode=require` in `DATABASE_URL` for a hosted database, and a database user that only has
  access to this database.
- Run `npm run migrate:up` in `apps/backend`. Never run `npm run seed` against production (it refuses
  to when `NODE_ENV=production`): every sample account has a known password.
- `NEXT_PUBLIC_API_URL` is built into the browser bundle, so it must only ever hold the public API URL.

## Code quality

| Command                                   | What it does                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `npm run check`                           | Everything CI runs: format check, lint, type check, tests with coverage |
| `npm run lint` / `npm run lint:fix`       | ESLint in both apps (type-aware in the backend)                         |
| `npm run format` / `npm run format:check` | Prettier, configured in `.prettierrc.json`                              |
| `npm run typecheck`                       | `tsc --noEmit` in both apps                                             |
| `npm test`                                | The tests; `npm run test:coverage` adds a coverage report               |

Both apps must keep **at least 80%** coverage of statements, branches, functions and lines; the run fails
below that. Reports go to `apps/*/coverage/` (open `index.html`). Entry points, scripts and the route files
that only render a feature are left out of the count.

Git hooks (Husky) are installed by `npm install`: **pre-commit** formats and lints the staged files,
**pre-push** runs the type check and the tests with coverage. GitHub Actions (`.github/workflows/ci.yml`)
runs the same checks plus the build on every pull request.

The backend tests start a throwaway local server per request, so they retry a failed test twice; on a busy
machine another process occasionally answers on the same random port. A real failure still fails.

## Project structure

**`apps/backend`** (Express + PostgreSQL)

| Folder                   | Holds                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/<feature>/` | One folder per feature: `*.routes.ts` (HTTP only: read the request, check access, choose the status), `*.repository.ts` (all SQL), and a `*.service.ts` where rules span several queries |
| `src/http/`              | Sign-in and role middleware, `HttpError` and the error handler, rate limits, the request log, query helpers                                                                              |
| `src/db/`                | The connection pool and `withTransaction`                                                                                                                                                |
| `src/lib/`               | Framework-free helpers: passwords, session tokens, roles, validation                                                                                                                     |
| `src/config/env.ts`      | Every environment setting, typed                                                                                                                                                         |
| `src/emails/`            | Email templates and the mailer                                                                                                                                                           |
| `src/scripts/`           | `seed` and `holidays`                                                                                                                                                                    |
| `migrations/`            | Database migrations (node-pg-migrate)                                                                                                                                                    |

Routes throw `HttpError(status, message, code?)` for every failure; one handler turns it into `{ message, code }`.

**`apps/web`** (Next.js)

| Folder                | Holds                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `app/`                | Routes only: each `page.tsx` or `layout.tsx` is a few lines that render a feature          |
| `features/<feature>/` | A screen's components, hooks and helpers, side by side                                     |
| `components/ui/`      | Shared building blocks: buttons, fields, alerts, `SegmentedControl`, `Avatar`, `Skeleton`… |
| `components/layout/`  | The dashboard header and menu, logo, language switch, error reporter                       |
| `lib/`                | Shared logic: `api/` (client, `useApi`, `useSend`), `dates/`, colors, roles, types         |
| `i18n/`, `messages/`  | Languages: every text lives in `messages/en.json` and `messages/ro.json`                   |

Imports use `@/…` paths; tests sit next to the file they test.

## Data

Run these in `apps/backend`. Every sample account has the password `password123`.

| Command                             | What it does                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run seed`                      | Creates the demo school (code `DEMO`); sign in as `admin@demo.edu`                     |
| `npm run seed -- --reset`           | Deletes the demo school and creates it again                                           |
| `npm run seed -- --school <CODE>`   | Adds sample classes, teachers, students and a timetable to an existing school          |
| `npm run seed -- --teacher <EMAIL>` | Fills in around an existing teacher: students, two more courses, parents' meetings     |
| `npm run holidays`                  | Copies the public holidays in `data/holidays/*.json` into the database                 |
| `npm run holidays -- --fetch 2027`  | Refreshes a year of `RO.json` from [Nager.Date](https://date.nager.at), then copies it |

Public holidays are edited in `apps/backend/data/holidays/RO.json`: add, change or remove an entry and run
`npm run holidays`. They remove lessons on those days and show in every Romanian school's calendar.

## Monitoring

Failed API requests (4xx as warnings, 5xx as errors), requests slower than a second and errors in the web
app are logged to the `api_logs` table for 30 days. School admins see their school's entries under
**Overview → System health**; super admins see every school, with stack traces. Request bodies, passwords
and tokens are never logged.
