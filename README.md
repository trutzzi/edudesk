# EduDesk

School management for admins, teachers, students and parents. A school sets up its classes, courses and
calendar once, and everyone sees a timetable that stays up to date. The app is in English and Romanian.

## What it does

- **Classes and courses**: create classes, enrol students, and give each course a teacher, a weekly
  schedule and the dates it runs. Lessons are generated from the schedule.
- **Personal timetables**: teachers, students and parents see their own lessons by day, week or month,
  with a marker for the current time.
- **School-wide timeline**: admins see every course and lesson across the year, grouped by class or
  teacher, zooming from a term down to a single day.
- **School calendar**: exams, trips, parents' meetings and other events for the whole school or one class.
  Romanian public holidays are included and cancel that day's lessons.
- **Invitations and roles**: admins invite teachers, students and parents by email; teachers invite their
  own students. Each person only sees what their role allows.
- **Overview and monitoring**: live statistics for the school, plus a log of failed and slow requests and
  of errors in the web app.

| Role         | Can                                                                                 |
| ------------ | ----------------------------------------------------------------------------------- |
| Super admin  | See statistics and system health for every school on the platform                   |
| School admin | Set up the school, classes, courses and schedules; invite people; plan the calendar |
| Teacher      | See their timetable and the classes they teach; invite students to those classes    |
| Student      | See their own timetable and the school calendar                                     |
| Parent       | See their child's timetable and the school calendar                                 |

- `apps/web` – Next.js frontend
- `apps/backend` – Express API + PostgreSQL

## Getting started

You need Node 22+ (`.nvmrc`; run `nvm use`) and a running PostgreSQL.

```bash
npm install && npm run install:all
cp apps/backend/.env.example apps/backend/.env   # fill in DATABASE_URL and JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run start:local
```

The app runs on http://localhost:3000 and the API on http://localhost:4000.

## Deploying

Every push to `main` that passes the checks is deployed by the `deploy` job in
`.github/workflows/ci.yml`. It builds two Docker images (`apps/backend/Dockerfile` and
`apps/web/Dockerfile`), uploads them over SSH and runs `deploy/remote-deploy.sh` on the server. That
script loads the images, runs the migrations and the holiday import, and restarts the containers from
`deploy/docker-compose.yml`: the API, the web app and their own PostgreSQL. If the API isn't healthy
afterwards, it goes back to the previous images. The last three releases are kept.

### Server setup (once)

The server needs Docker with the compose plugin. No Node.js is installed on it. HTTPS comes from the
Caddy container already on the server (`albumflow-caddy-1`), which EduDesk's containers join through
the `albumflow_default` network.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy              # lets CI run docker; equivalent to root, so guard the key
# add the deploy key's public half to /home/deploy/.ssh/authorized_keys
sudo mkdir -p /var/www/edudesk/{releases,shared} && sudo chown -R deploy: /var/www/edudesk
sudo -u deploy nano /var/www/edudesk/shared/backend.env   # from apps/backend/.env.example
sudo chmod 600 /var/www/edudesk/shared/backend.env
```

In `backend.env`, set `NODE_ENV=production`, a `POSTGRES_PASSWORD`, and
`DATABASE_URL=postgres://edudesk:<that password>@db:5432/edudesk`. Then add the site from
`deploy/Caddyfile.example` to Caddy's config, which serves both apps from one domain. Outside Docker
the containers only listen on `127.0.0.1` (web on 3100, API on 4100).

### GitHub settings

Under **Settings → Environments**, create `production` (you can require an approval there), and add
these as variables or secrets:

| Name                  | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `DEPLOY_HOST`         | The server's address                                              |
| `DEPLOY_PORT`         | SSH port, if not 22                                               |
| `DEPLOY_USER`         | `deploy`                                                          |
| `DEPLOY_PATH`         | `/var/www/edudesk`                                                |
| `NEXT_PUBLIC_API_URL` | The site's public address, e.g. `https://edudesk.example.com`     |
| `DEPLOY_SSH_KEY`      | Secret: the private key whose public half is in `authorized_keys` |
| `DEPLOY_KNOWN_HOSTS`  | Secret: the output of `ssh-keyscan -p <port> <host>`              |

To roll back by hand, set `IMAGE_TAG` in `/var/www/edudesk/.env` to an older folder name in
`releases/` and run `docker compose up -d` in `/var/www/edudesk`. Logs: `docker compose logs -f edudesk-api`.

### Security

- Secrets live only in `shared/backend.env` on the server and in GitHub secrets, never in the
  repository. Only the `.env.example` templates are committed.
- With `NODE_ENV=production` the API refuses to start unless `JWT_SECRET` (at least 32 random
  characters, e.g. `openssl rand -hex 32`), `DATABASE_URL`, `CORS_ORIGIN`, `APP_URL` and `SMTP_URL`
  are set.
- Set `CORS_ORIGIN` to the web app's exact origin, and `TRUST_PROXY=1` behind Caddy.
- The database has no published port: only the API container can reach it.
- Never run `npm run seed` against production (it refuses to when `NODE_ENV=production`): every
  sample account has a known password.
- `NEXT_PUBLIC_API_URL` is built into the browser code, so it must only ever hold the public API URL.

## Code quality

| Command                                   | What it does                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run check`                           | Everything CI runs: format check, lint, type check, tests with coverage      |
| `npm run lint` / `npm run lint:fix`       | ESLint in both apps (type-aware in the backend)                              |
| `npm run format` / `npm run format:check` | Prettier (`.prettierrc.json`), which also sorts imports and Tailwind classes |
| `npm run typecheck`                       | `tsc --noEmit` in both apps                                                  |
| `npm test`                                | The tests; `npm run test:coverage` adds a coverage report                    |

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
| `src/db/`                | The connection pool, `withTransaction`, and SQL pieces shared between queries (`sql.ts`)                                                                                                 |
| `src/lib/`               | Framework-free helpers: passwords, session tokens, roles, validation                                                                                                                     |
| `src/config/env.ts`      | Every environment setting, typed                                                                                                                                                         |
| `src/emails/`            | Email templates and the mailer                                                                                                                                                           |
| `src/scripts/`           | `seed` and `holidays`                                                                                                                                                                    |
| `migrations/`            | Database migrations (node-pg-migrate)                                                                                                                                                    |

Routes throw `HttpError(status, message, code?)` for every failure; one handler turns it into `{ message, code }`.

**`apps/web`** (Next.js)

| Folder                | Holds                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app/`                | Routes only: each `page.tsx` or `layout.tsx` is a few lines that render a feature                                     |
| `features/<feature>/` | A screen's components, hooks and helpers, side by side                                                                |
| `components/ui/`      | Shared building blocks: `buttonClass`, `cardClass`, fields, `SectionTitle`, `EmptyState`, `Icon`, `SegmentedControl`… |
| `components/layout/`  | The dashboard header and menu, logo, language switch, error reporter                                                  |
| `lib/`                | Shared logic: `api/` (client, `useApi`, `useSend`), `dates/`, colors, roles, types                                    |
| `i18n/`, `messages/`  | Languages: every text lives in `messages/en.json` and `messages/ro.json`                                              |

Imports use `@/…` paths; tests sit next to the file they test.

## Data

The same commands fill whichever environment they run in: on your machine they use `apps/backend/.env`,
on the server they run inside the API's container against its database. Every sample account has the
password `password123`, or `SEED_PASSWORD` when set; in production it must be set (12+ characters),
since the site is public.

```bash
# Your machine, from the repository root (or apps/backend)
npm run seed

# The server
cd /var/www/edudesk && read -rsp "Sample password: " SP && echo
docker compose run --rm -e SEED_PASSWORD="$SP" edudesk-api npm run seed; unset SP
```

Add the options below after `npm run seed --` (or after `npm run seed` in the container).

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
