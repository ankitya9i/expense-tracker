# Expense Tracker:

live link: https://serene-shortbread-512d3e.netlify.app

A small, production-minded full-stack expense tracker: record personal spending, filter by category, sort by date, see totals.

- **Backend**: Node.js + Express + TypeScript + Prisma + MySQL
- **Frontend**: React + Vite + TypeScript + TanStack Query
- **Hosting**: Railway (API + MySQL) · Netlify (frontend)

> **Why this exists.** A take-home exercise framed as *"build a small personal-finance tool, aim for production-like quality."* The feature list is intentionally small; most of the thinking went into money handling, idempotent writes, and retry-safe behavior under unreliable networks.

---

## Table of contents
- [Features](#features)
- [Live demo](#live-demo)
- [Quick start (local)](#quick-start-local)
- [API reference](#api-reference)
- [Testing](#testing)
- [Architecture](#architecture)
- [Key design decisions](#key-design-decisions)
- [Trade-offs made for the timebox](#trade-offs-made-for-the-timebox)
- [Explicitly not done](#explicitly-not-done)
- [Repository layout](#repository-layout)
- [Deployment](#deployment)

---

## Features
- Add an expense (amount, category, description, date) via a form with inline validation.
- View all expenses in a sortable table, with the **total for the currently visible list** shown on top.
- **Per-category summary** with bar chart — see where your money is going at a glance (sorted by spend).
- Filter by category.
- Sort by date (newest or oldest first).
- Category pills are color-coded for quick scanning.
- **Resilient submit**: double-clicks, page refreshes, and flaky networks do not create duplicate entries (idempotent POST with a client-generated key).
- **Resilient reads**: list view retries transparently on network errors and 5xx responses, with exponential backoff.
- Graceful loading, empty, and error states.

---

## Live demo

- **Web app (Netlify)**: _paste Netlify URL here_
- **API (Railway)**: <https://expense-tracker-production-28a5.up.railway.app>
- **Repo**: <https://github.com/ankitya9i/expense-tracker>

---

## Quick start (local)

### Prerequisites
- Node.js 20+
- MySQL 8 running locally (Docker works great — see `backend/docker-compose.yml`)

### 1. Start MySQL (skip if you already have one)
```bash
cd backend
docker compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env           # edit DATABASE_URL if your MySQL differs
npm install
npx prisma migrate dev --name init
npm run dev                    # http://localhost:4001
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env           # VITE_API_URL points at the backend
npm install
npm run dev                    # http://localhost:5173 (or 5174 if 5173 is busy)
```

> If the frontend picks a port other than 5173, add it to `FRONTEND_ORIGIN` in `backend/.env` (comma-separated) and restart the backend.

---

## API reference

Base URL (local): `http://localhost:4001`

| Method | Path                  | Notes                                                        |
|--------|-----------------------|--------------------------------------------------------------|
| POST   | `/expenses`           | Accepts `Idempotency-Key` header. Safe to retry.             |
| GET    | `/expenses`           | Supports `?category=<name>&sort=date_desc` (or `date_asc`).  |
| GET    | `/expenses/summary`   | Per-category totals (sorted by spend desc) + grand total.    |
| GET    | `/health`             | Liveness probe (`{ "status": "ok" }`).                       |

### `POST /expenses`

Request:
```http
POST /expenses
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```
```json
{
  "amount": "250.50",
  "category": "Food",
  "description": "Lunch",
  "date": "2026-04-21"
}
```

Response `201 Created`:
```json
{
  "id": "cmo81ikv00001i28z8750j52k",
  "amount": "250.50",
  "category": "Food",
  "description": "Lunch",
  "date": "2026-04-21",
  "createdAt": "2026-04-21T03:04:22.045Z"
}
```

**Idempotency semantics.** If the same `Idempotency-Key` is sent again (intentional retry, double-click, refresh), the server returns the **original** resource — the row is never inserted twice. Keys must be 8–128 chars, `[A-Za-z0-9_-]`.

### `GET /expenses?category=Food&sort=date_desc`

Response `200 OK`:
```json
{
  "expenses": [
    {
      "id": "...",
      "amount": "250.50",
      "category": "Food",
      "description": "Lunch",
      "date": "2026-04-21",
      "createdAt": "..."
    }
  ],
  "totalAmount": "371.25",
  "count": 2
}
```

`totalAmount` is computed on the server **after** the filter is applied, so it always reflects what the client is showing.

### `GET /expenses/summary`

Response `200 OK`:
```json
{
  "byCategory": [
    { "category": "Food", "total": "371.25", "count": 2 },
    { "category": "Travel", "total": "50.00", "count": 1 }
  ],
  "grandTotal": "421.25",
  "count": 3
}
```

Always returns the full breakdown (ignores filter state). Categories are sorted by total **descending** so the biggest spend comes first.

### Try it with cURL

```bash
# Create (idempotent)
curl -X POST http://localhost:4001/expenses \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-key-0001" \
  -d '{"amount":"250.50","category":"Food","description":"Lunch","date":"2026-04-21"}'

# Re-send the exact same request — returns the same id, no duplicate row
curl -X POST http://localhost:4001/expenses \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-key-0001" \
  -d '{"amount":"250.50","category":"Food","description":"Lunch","date":"2026-04-21"}'

# List everything, newest first (default)
curl http://localhost:4001/expenses

# Filter + sort
curl "http://localhost:4001/expenses?category=Food&sort=date_desc"

# Validation example — negative amount
curl -X POST http://localhost:4001/expenses \
  -H "Content-Type: application/json" \
  -d '{"amount":"-10","category":"Food","description":"bad","date":"2026-04-21"}'
```

### Error shape

All errors are JSON:
```json
{ "error": "validation_error", "message": "Request validation failed", "details": { "amount": ["Amount must be greater than zero"] } }
```

| HTTP | `error` code                | When                                             |
|------|-----------------------------|--------------------------------------------------|
| 400  | `validation_error`          | Body or query fails zod validation               |
| 400  | `invalid_idempotency_key`   | Header present but malformed                     |
| 400  | `db_error`                  | Prisma known error (e.g. constraint)             |
| 404  | `not_found`                 | Unknown route                                    |
| 500  | `internal_error`            | Anything unexpected (full detail only in logs)   |

---

## Testing

Run from each package root:
```bash
npm test          # one-shot run
npm run test:watch
```

### What's covered

**Backend (`vitest`, 36 tests)**
- `money.test.ts` — rupee ↔ paise round-trip, no-float-drift summing, rejection of malformed input, negative-value formatting.
- `expenses.schema.test.ts` — zod validation for create + list query (required fields, amount precision, date format).
- `expense.service.test.ts` — end-to-end service behavior against an in-memory Prisma double:
  - Create persists, returns fixed-2 rupee string.
  - Amount is stored as integer paise (0.10 + 0.20 = exactly 30 paise, not 30.000000004).
  - Same `Idempotency-Key` → same resource, row inserted once.
  - Different keys → distinct rows.
  - No key → each call creates a new row (expected behavior when the client doesn't opt in).
  - Filter, sort asc/desc, per-filter total, empty-filter total = `"0.00"`.
  - Summary: empty case, per-category grouping with counts + totals, sorted by total desc, paise-accurate sums.

**Frontend (`vitest` + `jsdom`, 5 tests)**
- `api.test.ts` — the fetch wrapper:
  - Sends `Idempotency-Key` header and JSON body.
  - Retries on 5xx while keeping the **same** key across attempts (proves retries can't duplicate writes).
  - Does **not** retry on 4xx (client bugs should surface immediately).
  - Builds query string correctly when filters are supplied, and omits `?` when none are.

### Why a fake Prisma instead of a real DB?

The service is injected with the Prisma client, so tests use a tiny in-memory double (`tests/helpers/fake-prisma.ts`). That keeps unit/service tests hermetic and fast (13ms) while still exercising the real service code — transactions, upserts, ordering, filtering. A full DB-backed integration test would add more confidence at the cost of Docker as a hard test dependency.

---

## Architecture

```
┌─────────────┐    HTTPS JSON     ┌──────────────┐    SQL    ┌──────────┐
│  React app  │ ────────────────▶ │  Express API │ ────────▶ │  MySQL   │
│   (Vite)    │ ◀──────────────── │  (+ Prisma)  │ ◀──────── │          │
└─────────────┘                   └──────────────┘           └──────────┘
  • TanStack Query                  • zod validation            • expenses
  • fetch + retry/backoff           • Idempotency middleware    • idempotency_keys
  • Per-submit Idempotency-Key      • pino structured logs
                                    • Graceful SIGTERM shutdown
```

---

## Key design decisions

### Money as integer paise
Amounts are stored as `BIGINT` paise (1/100 of a rupee) and exchanged over the wire as fixed-2 decimal strings like `"250.50"`. Floating-point never touches money. Round-trips and sums are tested.

### Idempotency for POST
The frontend generates one UUID **per submission** (not per render) and sends it as `Idempotency-Key`. The server stores the mapping `key → expense.id` inside the **same transaction** as the insert. Subsequent requests with the same key return the original resource. Covers:
- Accidental double-clicks on the submit button
- Page refresh mid-request
- Automatic retry on a flaky network / 5xx

### Retries on the client
The `fetch` wrapper retries **only** on network errors and 5xx responses, with exponential backoff (300 → 600 → 1200 ms). 4xx is treated as a client bug and surfaced immediately. Because the `Idempotency-Key` is stable across retries, duplicates cannot occur.

### MySQL + Prisma
- MySQL because it's what the user already runs; InnoDB's ACID + proper types are sufficient for money at this scale.
- Prisma gives typed queries, safe migrations, and easy local dev.
- Indexes on `category` and `date` — the two filter/sort paths.

### Validation
`zod` on the server — fails closed with field-level error details. The frontend duplicates the rules for UX, but the server is the source of truth.

### Logging
`pino` + `pino-http` for structured request logs. Pretty-printed in dev, JSON in prod. `authorization` and `cookie` headers are redacted.

### Error handling
A single error middleware maps `ZodError` → 400, known `HttpError` → its status, Prisma errors → 400 with a safe public message, anything else → 500 with a generic message (full error only in the log).

### Graceful shutdown
`SIGTERM` / `SIGINT` → stop accepting connections, drain Prisma pool, exit. Matters for zero-downtime redeploys on Railway.

---

## Trade-offs made for the timebox

- **No authentication** — assignment is a single-user tool. Adding auth would double the surface without changing the evaluation signal.
- **No pagination** — bounded list at personal-use scale; if this grew, cursor pagination on `(date, id)` is the natural next step.
- **No delete/edit endpoints** — assignment didn't ask; data model supports them without changes.
- **Frontend component tests are light.** The highest-leverage behavior (idempotency-key stability, no-4xx-retry, query-string building) is covered in `api.test.ts`. Full UI-level tests would add coverage but not much signal for this scope.
- **Idempotency keys never expire** in this cut. In production I'd TTL them (e.g. 24 h) with a background cleanup job or a partial index with `createdAt`.

---

## Explicitly not done
- Auth / multi-user
- Edit / delete
- CSV export / import
- Category management UI (categories are a static list)
- E2E tests (Playwright) — covered instead by unit + service-level tests
- Rate limiting — would add `express-rate-limit` in production

---

## Repository layout
```
expense-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Expense + IdempotencyKey
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts                # boot + graceful shutdown
│   │   ├── app.ts                 # Express wiring
│   │   ├── config/env.ts          # zod-validated env
│   │   ├── lib/                   # logger, prisma, money helpers
│   │   ├── middleware/            # error handler, idempotency
│   │   ├── routes/                # expenses routes + zod schemas
│   │   └── services/              # ExpenseService
│   ├── tests/                     # money, schema, service (via fake Prisma)
│   └── docker-compose.yml
└── frontend/
    ├── src/
    │   ├── main.tsx               # React Query provider
    │   ├── App.tsx
    │   ├── components/            # ExpenseForm, ExpenseList, Filters
    │   ├── lib/                   # api client (retry+backoff), uuid
    │   ├── types/
    │   └── styles.css
    └── tests/                     # api client behavior (fetch mocked)
```

---

## Deployment

### Backend → Railway
1. Create a Railway project and add a **MySQL** service.
2. Add a **Node service** from this repo with **Root Directory** = `backend/`.
3. **Build Command**: `npm ci && npx prisma generate && npm run build`
4. **Start Command**: `npm run start:prod` (runs `prisma migrate deploy`, then the server).
5. **Healthcheck Path**: `/health`
6. **Env vars**:
   - `DATABASE_URL` → reference the MySQL service, e.g. `${{ MySQL.MYSQL_URL }}`
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN=https://<your-netlify-domain>`
   - `LOG_LEVEL=info`
7. In **Networking**, click **Generate Domain** to expose a public URL.

> The server binds to `0.0.0.0` and reads `PORT` from the environment, so Railway's injected `PORT` works automatically.

### Frontend → Netlify
1. Connect the repo in Netlify.
2. **Base directory**: `frontend`
3. **Build command**: `npm run build`
4. **Publish directory**: `frontend/dist`
5. **Environment variables**: `VITE_API_URL=https://<your-railway-backend-url>`
6. SPA fallback: `frontend/public/_redirects` is already committed (`/* /index.html 200`) — no extra config needed.

> Vite inlines env vars at **build time**. If `VITE_API_URL` changes, trigger a new build (Netlify → Deploys → Trigger deploy).

### Post-deploy smoke test
```bash
curl https://<api>/health
curl -X POST https://<api>/expenses \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: post-deploy-smoke-0001" \
  -d '{"amount":"1.00","category":"Other","description":"smoke test","date":"2026-04-21"}'
```

### Post-deploy smoke test
```bash
curl https://<api>/health
curl -X POST https://<api>/expenses \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: post-deploy-smoke-0001" \
  -d '{"amount":"1.00","category":"Other","description":"smoke test","date":"2026-04-21"}'
```
