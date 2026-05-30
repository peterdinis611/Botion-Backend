# Botion — Backend

NestJS API for [Botion](https://github.com): a Notion-style workspace with notes, notebooks, tags, Snaps, graphs, calendar, sharing, and real-time updates.

## Tech stack

- **NestJS 11** — HTTP API and GraphQL
- **Apollo Server** — GraphQL (`/graphql`) with WebSocket subscriptions (`graphql-ws`)
- **Drizzle ORM** — SQLite via `better-sqlite3`
- **JWT** — Authentication for queries, mutations, and subscriptions

## Prerequisites

- **Node.js** 20+
- **pnpm** (recommended)

Native build tools may be required for `better-sqlite3` (macOS: Xcode CLT; Linux: `build-essential`).

## Quick start

```bash
cd backend
pnpm install
cp .env.example .env
pnpm start:dev
```

The API listens on **http://localhost:3000** by default. GraphQL playground: **http://localhost:3000/graphql**.

Start the [frontend](../frontend/README.md) on port **3001** so CORS and auth flows work out of the box.

On startup, the app:

1. Locates the backend package root (finds `drizzle/meta/_journal.json`)
2. Opens **`sqlite.db`** at the package root (not inside `dist/`)
3. Runs Drizzle migrations and applies critical schema patches if needed

You should see a log line like: `Using database: …/backend/sqlite.db`

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required in prod)* | Signing key for access tokens. Keep stable across restarts or all sessions invalidate. |
| `JWT_EXPIRES_IN_SECONDS` | `2592000` (30 days) | Token lifetime |
| `PORT` | `3000` | HTTP port |
| `FRONTEND_URL` | `http://localhost:3001` | CORS allowed origin |
| `DEMO_ACCOUNTS_ENABLED` | enabled | Set to `false` to disable `createDemoAccount` |
| `TMP_FILE_MAX_AGE_HOURS` | — | Temp upload cleanup age |
| `TMP_CLEANUP_ENABLED` | enabled | Set to `false` to disable temp file cleanup job |
| `TMP_CLEANUP_CRON` | hourly | Cron expression for cleanup |

## Database

- **File:** `backend/sqlite.db` (gitignored)
- **Schema:** `src/drizzle/schema.ts`
- **Migrations:** `drizzle/*.sql`

```bash
# Generate a migration after schema changes
pnpm db:generate

# Push schema (dev only; prefer migrations in shared environments)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

If create workspace/page fails after a pull, restart `pnpm start:dev` and confirm migrations ran (check startup logs and `sort_order` / latest columns exist).

## Project structure

```
src/
├── auth/              # JWT, login, register, demo accounts
├── users/             # User profile and preferences
├── drizzle/           # Schema, provider, migrations runner
├── events/            # GraphQL subscriptions (app events)
├── cache/             # In-memory cache for notes/notebooks
└── app/
    ├── notes/         # Pages, sharing, revisions
    ├── notebooks/     # Workspaces / notebooks
    ├── folders/       # Folder hierarchy
    ├── tags/          # Tags (global and per-notebook)
    ├── snaps/         # Reference panel assets
    ├── graphs/        # Flow diagrams (React Flow payload)
    ├── calendar/      # Calendar events
    ├── workspace/     # Invites, collaborators, page share links
    ├── notifications/
    └── files/         # Uploads and temp file cleanup
```

Generated GraphQL schema: `src/schema.gql` (auto-updated in dev).

## GraphQL overview

**Public mutations**

- `register`, `login`, `createDemoAccount`

**Authenticated** (Bearer token in `Authorization` header; subscriptions use `connectionParams.authorization`)

- **Notes:** `createNote`, `updateNote`, `removeNote`, `reorderNotes`, `sharePageWithCollaborator`, `unshareNote`, …
- **Workspace:** `inviteWorkspaceMember`, `cancelWorkspaceInvite`, `acceptWorkspaceInvite`, `workspaceCollaborators`
- **Snaps, graphs, calendar, tags, folders, notebooks** — CRUD + list queries
- **Subscriptions:** `appEvent` — live note/workspace updates

Use the GraphQL playground at `/graphql` with a token from `login` or `register`:

```http
Authorization: Bearer <token>
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm start:dev` | Dev server with watch |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run `node dist/main` |
| `pnpm test` | Unit tests (Jest) |
| `pnpm test:e2e` | E2E tests |
| `pnpm lint` | ESLint |

## Development notes

- Run commands from **`backend/`**, not the repo root.
- After `nest build`, runtime still resolves DB and migrations from the backend package root (see `drizzle.provider.ts`).
- Soft delete for notes uses `isArchived`; deleting a notebook archives its notes first.
- File uploads are served under the files module; temp uploads are cleaned on a schedule.

## Related

- [Frontend README](../frontend/README.md)
