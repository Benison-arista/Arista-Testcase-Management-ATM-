# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arista Testcase Management (ATM)** — A full-stack QA management tool for organizing test cases across two product lines (VeloCloud and Arista) and tracking test run results by release/feature. Supports JWT-based authentication with three roles: **viewer** (read-only), **editor** (CRUD on test cases/folders), **run_manager** (full access including test run management and user registration).

## Development Commands

### Infrastructure (start first)
```bash
docker compose up -d        # Start PostgreSQL (5432) + pgAdmin (5050)
```

### Backend
```bash
cd backend
npm install
npm run dev                 # nodemon auto-reload on :3001
npm start                   # production
node scripts/seed-admin.js  # Create initial run_manager user (admin/admin123)
```

### Frontend
```bash
cd frontend
npm install
npm run dev                 # Vite HMR dev server on :5173
npm run build               # production build
npm run lint                # ESLint
npm run preview             # preview production build
```

Backend runs on `:3001`; Vite proxies all `/api` requests to it in dev (configured in [frontend/vite.config.js](frontend/vite.config.js)).

### Database
- Versioned migrations run automatically on backend startup via [backend/src/db.js](backend/src/db.js)
- Migration files in `backend/migrations/` are applied in order; tracked in `schema_migrations` table
- `001_init.sql` — base schema; `002_auth.sql` — users, roles, indexes, optimistic locking
- Default connection: `postgresql://atm:atm_secret@localhost:5432/atm_db` (set in [backend/.env](backend/.env))

### First-time Setup
```bash
docker compose up -d
cd backend && npm install && node scripts/seed-admin.js
# Then start backend (npm run dev) and frontend (cd ../frontend && npm run dev)
# Login with admin / admin123
```

## Architecture

### Request Flow
```
Browser → Vite dev proxy → Express (:3001) → auth middleware → authorize middleware → Controller → pg Pool → PostgreSQL
```

### Authentication & Authorization
- **JWT-based auth** — `POST /api/auth/login` returns a JWT; all other `/api/*` routes require `Authorization: Bearer <token>`
- **Middleware chain**: `auth.js` (validates JWT, attaches `req.user`) → `authorize.js` (checks role against allowed roles)
- **Role hierarchy**: `run_manager` > `editor` > `viewer` — higher roles inherit all lower permissions
- **Role-permission matrix**:
  - Viewer: GET all resources
  - Editor: + POST/PUT/DELETE testcases, folders, run items, import
  - Run Manager: + POST/DELETE run_folders, POST /auth/register

### Backend: `backend/src/`
- **`index.js`** — Express app entry; CORS restricted to `CORS_ORIGIN` env var; auth middleware applied globally to `/api/folders`, `/api/testcases`, `/api/runs`
- **`db.js`** — `pg` Pool (max 20 connections, timeouts configured) + versioned migration runner
- **`middleware/`** — `auth.js` (JWT verification), `authorize.js` (role checking), `errorHandler.js` (safe error responses)
- **`routes/`** — Route definitions with `authorize()` middleware per endpoint
- **`controllers/`** — All business logic; user identity from `req.user` (never from request body):
  - `authController.js` — Login, register, me
  - `testcaseController.js` — Paginated list/search, CRUD with optimistic locking, batch import (multi-value INSERT in chunks of 500), paginated history
  - `folderController.js` — Recursive CTE folder tree (capped at 1000 nodes), CRUD
  - `runController.js` — Run folder tree, paginated run items with optimistic locking, reports

### Pagination Convention
All list endpoints return paginated responses:
```json
{ "data": [...], "pagination": { "page": 1, "limit": 50, "total": 196888, "totalPages": 3938 } }
```
Query params: `?page=1&limit=50` (defaults: page=1, limit=50, max=200).

### Frontend: `frontend/src/`
- **`App.jsx`** — Root layout with 3-tab navigation; renders `UserPrompt` (login form) if not authenticated
- **`stores/`** — Zustand state slices:
  - `useAppStore.js` — JWT auth (`login`, `logout`), `user` object with role, computed `isEditor()` / `isRunManager()`
  - `useFolderStore.js` — Selected folder, folder tree
  - `useTCStore.js` — Paginated test case list, selection, CRUD ops
  - `useSearchStore.js` — Debounced search with pagination
  - `useRunStore.js` — Run tree, paginated run items, reports
- **`api/`** — Axios wrappers; `client.js` auto-attaches JWT via request interceptor, handles 401 via response interceptor
- **`schemas/`** — Field definitions that drive dynamic form rendering
- **`components/`** — UI organized by domain; role checks use `isEditor()` / `isRunManager()` from `useAppStore`

### Database Schema
- **`users`** — JWT auth with bcrypt password hashing; `role` enum (viewer/editor/run_manager)
- **`folders`** — Hierarchical (parent_id self-reference), scoped by `section` (velocloud/arista)
- **`testcases`** — Core table; `data` JSONB, `version` for optimistic locking; FK columns for user IDs alongside legacy TEXT `created_by`
- **`testcase_history`** — Full snapshot on each update (audit trail)
- **`run_folders`** — Release/feature hierarchy for test runs
- **`test_runs`** — Execution records (pass/fail/blocked/pending), `lock_version` for optimistic locking
- **`schema_migrations`** — Tracks applied migrations

### Key Patterns
- **JSONB storage**: Test case fields live in a `data JSONB` column — allows schema changes without migrations. Indexed with a GIN index.
- **Dynamic field rendering**: `DynamicField.jsx` renders form controls driven by schema definitions; adding a new field means updating the schema file only.
- **3-pane layout**: FolderTree → TCList → TCDetail/TCTable; selection state flows through Zustand stores.
- **Optimistic locking**: `version` column on testcases, `lock_version` on test_runs; UPDATE requires matching version, returns 409 on conflict.
- **Batch import**: Multi-value INSERT in chunks of 500 rows per batch, all within a single transaction.
- **Search debounce**: TopBar search debounces 300ms before firing API call.

### Environment Variables (backend/.env)
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for signing JWTs
- `JWT_EXPIRES_IN` — Token expiry (default: 8h)
- `CORS_ORIGIN` — Allowed origin for CORS (default: http://localhost:5173)
- `DB_POOL_MAX` — Max pool connections (default: 20)
