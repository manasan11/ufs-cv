# CV Generator

Full-stack CV management app: an Angular 21 single-page app for creating, browsing and
exporting CVs, backed by an Express REST API, MySQL persistence and PDFKit PDF generation.

A "user" in the UI is a single CV profile. JWT accounts (the optional sign-in feature) are a
separate concept used to record ownership of the CVs you create.

## Features

- CV list with full-text search across personal details, experience, education and skills
- Sorting by name/created/updated date and configurable page size
- Create and edit form covering personal details, experience, education and skills
- Date inputs at month precision (`YYYY-MM`), matching the API contract end to end
- Server-side validation with per-field error messages mapped back onto the form
- PDF export with automatic page breaks, skill categories and repeating footers
- Optional JWT authentication (`AUTH_REQUIRED`): when enabled, CV endpoints require a token
  and users only see the CVs they own
- Drift-aware database migration and a deterministic 25-CV seed

## Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Frontend | Angular 21.2, TypeScript, standalone components, Vitest |
| Backend  | Node 22, Express 4, TypeScript, Zod                   |
| Database | MySQL 8                                               |
| PDF      | PDFKit                                                |

> **Node version:** this project targets Angular 21 on purpose. Angular 22 requires Node
> `>= 22.22.3`; the version used here is Node `22.20.0`.

## Repository layout

```
server/   Express API, MySQL migration + seed, PDF service, Vitest tests
web/      Angular SPA (list, form, auth pages), dev proxy to the API
```

## Prerequisites

- Node.js 22.20.0 (or any 22.x)
- npm 10+
- MySQL 8 reachable by the API

## Getting started

### 1. Database

Either use an existing MySQL 8 server, or start the bundled one:

```bash
docker compose up -d mysql
```

This exposes MySQL on `127.0.0.1:3307` with user `cvapp` / password `cvapp_dev_pw`.

### 2. API

```bash
cd server
npm install
cp .env.example .env      # then edit DB_* and JWT_SECRET as needed
npm run migrate           # creates the database and tables
npm run seed              # optional: 25 sample CVs + demo@example.com
npm run dev               # http://localhost:4000
```

Useful scripts:

| Script            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start the API with file watching         |
| `npm run build`   | Compile TypeScript to `dist/`           |
| `npm start`       | Run the compiled server                 |
| `npm run typecheck` | Type-check without emitting           |
| `npm test`        | Run the Vitest suite                    |

The migration is drift aware: it compares the expected table definitions with the live
database and rebuilds the affected tables when it finds a mismatch, so a partially created
or previously modified schema is corrected automatically.

### 3. Web app

```bash
cd web
npm install
npm start                # http://localhost:4200
```

`web/proxy.conf.json` forwards `/api` to `http://localhost:4000`, so the SPA talks to the
API same-origin during development.

> If `npm install` fails with `Cannot read properties of null (reading 'edgesOut')`, it is an
> npm bug in the Vitest peer graph rather than a project problem. Use
> `npm install --legacy-peer-deps`.

## Authentication

Auth is off by default so the app is usable without an account.

- `GET /api/auth/config` tells the UI whether auth is required and registration is open.
- `POST /api/auth/register` and `POST /api/auth/login` return a JWT; the SPA stores it in
  `localStorage` and sends it as `Authorization: Bearer <token>`.
- `GET /api/auth/me` returns the signed-in account.
- Set `AUTH_REQUIRED=true` to make every CV endpoint require a valid token. In that mode
  listing is scoped to the caller's own CVs and reading, editing or deleting someone else's
  CV returns `403`.

The seed creates a demo account: `demo@example.com` / `demo-password-123`.

## API

All responses are wrapped as `{ "data": ... }`; errors are
`{ "error": { "code", "message", "details" } }`. List responses add a top-level `meta`.

| Method   | Path                 | Notes                                              |
| -------- | -------------------- | -------------------------------------------------- |
| `GET`    | `/api/health`        | Database connectivity and uptime                   |
| `GET`    | `/api/cvs`           | `page`, `limit` (1-100), `search`, `sort`          |
| `POST`   | `/api/cvs`           | Create a CV                                        |
| `GET`    | `/api/cvs/:id`       | Full CV with personal/experience/education/skills  |
| `PUT`    | `/api/cvs/:id`       | Replaces the whole CV                              |
| `DELETE` | `/api/cvs/:id`       | Delete a CV and its children                       |
| `GET`    | `/api/cvs/:id/pdf`   | PDF attachment with a slugged filename             |
| `GET`    | `/api/auth/config`   | `{ authRequired, registrationOpen }`               |
| `POST`   | `/api/auth/register` | Create an account, returns a token                 |
| `POST`   | `/api/auth/login`    | Returns a token                                    |
| `GET`    | `/api/auth/me`       | Current account                                     |

`sort` accepts `createdAt`, `-createdAt`, `updatedAt`, `-updatedAt`, `name`, `-name`.

Dates are `YYYY-MM` strings everywhere. MySQL stores them as `DATE` columns pinned to the
first of the month, and the API converts on the way in and out.

## Testing

```bash
cd server && npm test     # 68 API and PDF tests
cd web    && npm test     # Angular component tests
```

Backend tests run against a dedicated `cv_generator_test` database. `vitest.config.ts`
forces that name and `tests/setup.ts` refuses to run against anything else, so a test run
can never touch your development data.

## Production build

```bash
cd server && npm run build && npm start
cd web    && npm run build      # static output in web/dist/web/browser
```

Serve the compiled Angular bundle with any static file server and point it at the API, or
host the API behind the same origin and let the SPA call `/api` relatively.
