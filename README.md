# Expense Tracker

A small full-stack personal expense tracker. Built for production-like quality on a small surface area.

- **Backend**: Express + TypeScript + Prisma + MySQL
- **Frontend**: React + Vite + TypeScript + TanStack Query
- **Deployment**: Railway (API + MySQL), Vercel (frontend)

---

## Quick start (local)

### Prerequisites
- Node.js 20+
- Docker (for local MySQL)

### 1. Start MySQL
```bash
cd backend
docker compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates schema
npm run dev                          # http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
```

### Run tests
```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## API

| Method | Path          | Notes |
|--------|---------------|-------|
| POST   | `/expenses`   | Accepts `Idempotency-Key` header. Safe to retry. |
| GET    | `/expenses`   | Query: `?category=Food&sort=date_desc` |
| GET    | `/health`     | Liveness probe |

### `POST /expenses`
```json
{
  "amount": "250.50",
  "category": "Food",
  "description": "Lunch",
  "date": "2026-04-21"
}
```

Returns `201` with the created expense. If the same `Idempotency-Key` was already used, returns the **original** created resource — never creates a duplicate.

### `GET /expenses?category=Food&sort=date_desc`
```json
{
  "expenses": [ { "id": "...", "amount": "250.50", "category": "Food", "description": "Lunch", "date": "2026-04-21", "createdAt": "..." } ],
  "totalAmount": "250.50",
  "count": 1
}
```

`totalAmount` is computed on the server and reflects the filtered list.

---

## Key design decisions

### Money as integer paise
Amounts are stored as `BIGINT` paise (1/100 of a rupee) and exchanged over the wire as fixed-2 decimal strings like `"250.50"`. Floating-point never touches money. Round-trips and sums are tested.

### Idempotency for POST
The frontend generates a UUID per submission (not per render) and sends it as `Idempotency-Key`. The server stores the mapping `key → expense.id` inside the same transaction as the insert. Subsequent requests with the same key return the original resource. Covers:
- Accidental double-click on the submit button
- Page refresh mid-request
- Automatic retry on a flaky network / 5xx

### Retries on the client
The fetch wrapper retries **only** on network errors and 5xx responses, with exponential backoff (300ms → 600ms → 1200ms). 4xx is treated as a client bug and surfaced immediately. Because the `Idempotency-Key` is stable across retries, duplicates cannot occur.

### MySQL + Prisma
- MySQL because the user already runs it; DECIMAL + InnoDB ACID are sufficient for money at this scale.
- Prisma gives typed queries, safe migrations, and easy local dev.
- Indexes on `category` and `date` — the two filter/sort paths.

### Validation
`zod` on the server — fails closed with field-level error details. The frontend duplicates the rules for UX but the server is the source of truth.

### Logging
`pino` with `pino-http` for structured request logs. Pretty-printed in dev, JSON in prod. Authorization / cookie headers are redacted.

### Error handling
A single error middleware maps `ZodError` → 400, known `HttpError` → its status, Prisma errors → 400 with a safe message, and anything else → 500 with a generic message (full error only in the log).

---

## Trade-offs I made for the timebox

- **No authentication** — assignment is a single-user tool. Adding auth would double the frontend and backend surface for no evaluation benefit.
- **No pagination** — list is bounded at personal-use scale; if this grew, cursor pagination on `(date, id)` is the natural next step.
- **No delete/edit endpoints** — assignment didn't ask. The data model supports it without changes.
- **Summary-per-category view skipped** — would be ~30 minutes of additional work and an extra endpoint; the current `totalAmount` covers the core "where's my money going" question once filters are applied.
- **Frontend component tests** are light. The two most important behaviors (idempotency key stability, no-retry on 4xx) are covered by `api.test.ts`. Full UI component tests would add coverage but not much signal for this scope.
- **Idempotency keys never expire** in this cut. In production I'd TTL them (e.g., 24 hours) with a background cleanup job.

## Explicitly not done
- Auth / multi-user
- Edit / delete
- CSV export / import
- Category management UI (categories are a static list)
- E2E tests (Playwright) — covered instead by unit + integration-via-fake-db tests
- Rate limiting — would add `express-rate-limit` in production

---

## Repository layout
```
expense-tracker/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── main.ts              # boot + graceful shutdown
│   │   ├── app.ts               # Express wiring
│   │   ├── config/env.ts        # zod-validated env
│   │   ├── lib/                 # logger, prisma, money helpers
│   │   ├── middleware/          # error handler, idempotency
│   │   ├── routes/              # expenses routes + zod schemas
│   │   └── services/            # ExpenseService
│   ├── tests/                   # vitest (money, schema, service)
│   └── docker-compose.yml
└── frontend/
    ├── src/
    │   ├── main.tsx             # React Query provider
    │   ├── App.tsx
    │   ├── components/          # ExpenseForm, ExpenseList, Filters
    │   ├── lib/                 # api client (retry+backoff), uuid
    │   └── types/
    └── tests/                   # vitest (api client behavior)
```

---

## Deployment

### Backend → Railway
1. Create a Railway project, add **MySQL** service.
2. Add a **Node service** pointing at `backend/` (root directory).
3. Build command: `npm ci && npx prisma generate && npm run build`
4. Start command: `npm run start:prod` (runs `prisma migrate deploy` then the server).
5. Env vars:
   - `DATABASE_URL` → reference the MySQL service's `DATABASE_URL`
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN=https://<your-vercel-domain>`
   - `LOG_LEVEL=info`

### Frontend → Vercel
1. Import the repo, set project root to `frontend/`.
2. Build command: `npm run build`, output directory: `dist`.
3. Env var: `VITE_API_URL=https://<your-railway-backend-url>`.
