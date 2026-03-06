# Admin App Overview

This document describes the internal admin surface for Atlas, focused on monitoring and controlling the email sync engine.

- Read-only visibility into:
  - `sync_runs` (status, mode, stage, errors, cursorSnapshot metrics)
  - `mailbox_cursors` (backfill/delta state for Gmail/Outlook)
- Ability to:
  - Trigger a one-off `syncWorkerTick` manually
  - Toggle "Auto-Run" to trigger ticks repeatedly (every 5s)
  - Start runs for a mailbox via existing `/api/sync/start`
- Protected by a separate admin token (`ADMIN_APP_TOKEN`), not user sessions.

---

## Auth Model (Admin Credentials)

Configuration:

- `ADMIN_APP_TOKEN` (env var): A secret string used as the admin credential.

Authentication:

- Admin APIs and pages expect header:
  - `X-Admin-Token: <ADMIN_APP_TOKEN>`

- Helper: [`src/lib/server/admin-auth.ts`](src/lib/server/admin-auth.ts)
  - Validates the token against the environment variable.
  - All `/api/admin/*` routes call `requireAdmin`. If it throws, the route returns `401 Unauthorized`.

---

## Admin APIs

All admin APIs require the `x-admin-token` header with the configured `ADMIN_APP_TOKEN`.

### 1. List Recent Sync Runs

Route: [`GET /api/admin/sync-runs`](/api/admin/sync-runs)

File: [`src/app/api/admin/sync-runs/route.ts`](src/app/api/admin/sync-runs/route.ts)

Query parameters:

- `mailboxId?`: filter by `mailboxid`.
- `status?`: filter by `status` (`queued`, `running`, `paused`, `done`, `error`, `needs_reauth`).
- `limit?`:
  - Default: `50`
  - Max: `100`

Behavior:

- Selects a limited projection from `sync_runs`:
  ```sql
  id, userid, mailboxid, mode, status, stage, startedat, finishedat, importedcount, cursorsnapshot, error
  ```
- Orders by `startedat` descending.
- Applies the `limit` (bounded to <= 100).

Response shape:

```json
{
  "runs": [
    {
      "id": "mailbox:full:1730000000000",
      "userid": "user-id",
      "mailboxid": "mailbox-id",
      "mode": "full",
      "status": "error",
      "stage": "fetching",
      "startedat": 1730000000000,
      "finishedat": null,
      "importedcount": 123,
      "cursorsnapshot": {
        "gmailQuotaUnits": 500,
        "gmailCalls": 80,
        "outlookCalls": 0
      },
      "error": "Error: Gmail quota exceeded"
    }
  ]
}
```

### 2. Admin-Triggered Worker Tick

Route: [`POST /api/admin/sync-tick`](/api/admin/sync-tick)

File: [`src/app/api/admin/sync-tick/route.ts`](src/app/api/admin/sync-tick/route.ts)

Behavior:

- Auth via `requireAdmin`.
- Calls `syncWorkerTick()` directly (no additional filtering).

Response:

```json
{ "processed": 3 }
```

Where `processed` is the number of runs processed in that tick.

---

## Admin UI: [`/admin/sync`](/admin/sync)

Route: [`/admin/sync`](/admin/sync)

File: [`src/app/admin/sync/page.tsx`](src/app/admin/sync/page.tsx)

Client-side page that:

- Lets you paste and store the admin token.
- Lists recent sync runs (with metric limits).
- Provides buttons to fire `sync-tick` manually or automatically.

### 1. Admin Token Handling

- On mount:
  - Reads `atlas:adminToken` from `localStorage` (if set) and pre-populates the token field.
- UI:
  - An `input type="password"` for the token.
  - A `Set token` button that writes the token to `localStorage["atlas:adminToken"]`.

### 2. Fetching Runs with Error Details

- Uses `useSWR` with key `["/api/admin/sync-runs?limit=50", token]`.
- Displays a table with:
  - Run ID, Mailbox, Mode, Status, Stage, Imported Count, Times.
  - **Metrics/Error**:
    - If successful: Shows compact metrics (`G quota`, `G calls`, `O calls`).
    - If failed: Shows the full **Error message** in red.

### 3. Sync Controls

- **Run sync-tick**: Manually triggers one worker tick via the API.
- **Auto-Run (5s)**:
  - Toggles an interval that calls `handleSyncTick` every 5 seconds.
  - Useful for watching progress (Imported count) increase in real-time without setting up external crons.
  - Button turns red ("Stop Auto-Run") when active.

---

## Usage Summary

1. Set `ADMIN_APP_TOKEN` in your environment (Netlify/Local).
2. Open `/admin/sync`.
3. Paste the admin token and click `Set token`.
4. Use:
   - **Auto-Run** to process the queue.
   - **Run sync-tick** for single steps.
   - The table to monitor errors and progress.
