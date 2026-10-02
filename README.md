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

Run the tests with `npm test`.

## Data

Run these in `apps/backend`. Every sample account has the password `password123`.

| Command | What it does |
|---|---|
| `npm run seed` | Creates the demo school (code `DEMO`); sign in as `admin@demo.edu` |
| `npm run seed -- --reset` | Deletes the demo school and creates it again |
| `npm run seed -- --school <CODE>` | Adds sample classes, teachers, students and a timetable to an existing school |
| `npm run seed -- --teacher <EMAIL>` | Fills in around an existing teacher: students, two more courses, parents' meetings |
| `npm run holidays` | Copies the public holidays in `data/holidays/*.json` into the database |
| `npm run holidays -- --fetch 2027` | Refreshes a year of `RO.json` from [Nager.Date](https://date.nager.at), then copies it |

Public holidays are edited in `apps/backend/data/holidays/RO.json`: add, change or remove an entry and run
`npm run holidays`. They remove lessons on those days and show in every Romanian school's calendar.

## Monitoring

Failed API requests (4xx as warnings, 5xx as errors), requests slower than a second and errors in the web
app are logged to the `api_logs` table for 30 days. School admins see their school's entries under
**Overview → System health**; super admins see every school, with stack traces. Request bodies, passwords
and tokens are never logged.
