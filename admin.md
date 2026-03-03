## Admin App Overview

This document describes the internal admin surface for Atlas, focused on monitoring and controlling the email sync engine.

- Read-only visibility into:
  - `sync_runs` (status, mode, stage, errors, cursorSnapshot metrics)
  - `mailbox_cursors` (backfill/delta state for Gmail/Outlook)
- Ability to:
  - Trigger a one-off `syncWorkerTick` manually
  - Start runs for a mailbox via existing `/api/sync/start`
- Protected by a separate admin token (`ADMIN_APP_TOKEN`), not user sessions.

---

## Auth Model (Temporary Admin Credentials)

Configuration:

- `ADMIN_APP_TOKEN` (env var): long random string used as admin credential.

Authentication:

- Admin APIs and pages expect header:

  - `X-Admin-Token: <ADMIN_APP_TOKEN>`

- Helper: `src/lib/server/admin-auth.ts`

  ```ts
  import { NextRequest } from "next/server";

  export function requireAdmin(req: NextRequest) {
    const token = process.env.ADMIN_APP_TOKEN;
    const header = req.headers.get("x-admin-token");
    if (!token || header !== token) {
      const error = new Error("Unauthorized");
      throw error;
    }
  }
  ```

- All `/api/admin/*` routes call `requireAdmin`. If it throws, the route returns `401 Unauthorized`.

---

## Admin APIs

All admin APIs require the `x-admin-token` header with the configured `ADMIN_APP_TOKEN`.

### 1. List Recent Sync Runs

Route: `GET /api/admin/sync-runs`

File: `src/app/api/admin/sync-runs/route.ts`

Query parameters:

- `mailboxId?`: filter by `mailboxid`.
- `status?`: filter by `status` (`queued`, `running`, `paused`, `done`, `error`, `needs_reauth`).
- `limit?`:
  - Default: `50`
  - Max: `100`

Behavior:

- Selects a limited projection from `sync_runs`:

  ```sql
  id,
  userid,
  mailboxid,
  mode,
  status,
  stage,
  startedat,
  finishedat,
  importedcount,
  cursorsnapshot
  ```

- Orders by `startedat` descending.
- Applies the `limit` (bounded to <= 100) to keep metrics payload reasonable.

Response shape:

```json
{
  "runs": [
    {
      "id": "mailbox:full:1730000000000",
      "userid": "user-id",
      "mailboxid": "mailbox-id",
      "mode": "full",
      "status": "running",
      "stage": "fetching",
      "startedat": 1730000000000,
      "finishedat": null,
      "importedcount": 123,
      "cursorsnapshot": {
        "gmailQuotaUnits": 500,
        "gmailCalls": 80,
        "outlookCalls": 0
      }
    }
  ]
}
```

### 2. Single Sync Run Detail

Route: `GET /api/admin/sync-runs/:id`

File: `src/app/api/admin/sync-runs/[id]/route.ts`

Behavior:

- Auth via `requireAdmin`.
- Fetches a single row from `sync_runs` by `id`.
- If not found: `404`.

Response:

```json
{ "run": { /* full sync_runs row */ } }
```

Used primarily for deeper debugging; current UI uses the list endpoint.

### 3. Admin-Triggered Worker Tick

Route: `POST /api/admin/sync-tick`

File: `src/app/api/admin/sync-tick/route.ts`

Behavior:

- Auth via `requireAdmin`.
- Calls `syncWorkerTick()` directly (no additional filtering).

Response:

```json
{ "processed": 3 }
```

Where `processed` is the number of runs processed in that tick.

---

## Admin UI: `/admin/sync`

Route: `/admin/sync`

File: `src/app/admin/sync/page.tsx`

Client-side page that:

- Lets you paste and store the admin token.
- Lists recent sync runs (with metric limits).
- Provides a button to fire an admin-only `sync-tick`.

### 1. Admin Token Handling

- On mount:
  - Reads `atlas:adminToken` from `localStorage` (if set) and pre-populates the token field.
- UI:
  - An `input type="password"` for the token.
  - A `Set token` button that:
    - Stores the trimmed token in local state.
    - Writes it to `localStorage["atlas:adminToken"]`.

The client then uses this token for all admin API calls by setting the `x-admin-token` header.

### 2. Fetching Runs with Metric Limits

- Uses `useSWR` with key `["/api/admin/sync-runs?limit=50", token]`.
- Fetcher:

  ```ts
  const runsFetcher = async ([url, token]: [string, string]) => {
    const res = await fetch(url, {
      headers: { "x-admin-token": token },
    });
    if (!res.ok) {
      throw new Error(`Failed to load sync runs: ${res.status}`);
    }
    return res.json();
  };
  ```

- The server enforces `limit <= 100`, and the UI uses `limit=50` by default.

Result type:

```ts
type SyncRunRow = {
  id: string;
  userid: string;
  mailboxid: string;
  mode: string;
  status: string;
  stage: string | null;
  startedat: number;
  finishedat: number | null;
  importedcount: number | null;
  cursorsnapshot: unknown | null;
};
```

### 3. Run Sync-Tick Button

- In the header of the “Recent sync runs” card:

  ```tsx
  <Button type="button" size="sm" onClick={handleSyncTick}>
    Run sync-tick
  </Button>
  ```

- `handleSyncTick`:

  ```ts
  const handleSyncTick = async () => {
    if (!token) return;
    await fetch("/api/admin/sync-tick", {
      method: "POST",
      headers: { "x-admin-token": token },
    });
    await mutate();
  };
  ```

This allows manual advancement of the sync worker and immediate refresh of the run list.

### 4. Runs Table and Metrics Display

The table shows:

- Run: truncated `id` (mono).
- Mailbox: truncated `mailboxid` (mono).
- Mode: `"quick" | "full" | "delta"`.
- Status: `"queued" | "running" | "paused" | "done" | "error" | "needs_reauth"`.
- Stage: `"listing" | "fetching" | "upserting" | "aggregating"` (or blank).
- Imported: `importedcount`.
- Started / Finished: local date-times.
- Metrics:
  - Displays a compact summary of fields from `cursorsnapshot`:

    ```ts
    const metrics = (run.cursorsnapshot as any) || {};
    const gmailQuota = Number(metrics.gmailQuotaUnits || 0);
    const gmailCalls = Number(metrics.gmailCalls || 0);
    const outlookCalls = Number(metrics.outlookCalls || 0);

    const metricsSummary = [
      gmailQuota ? `G quota ${gmailQuota}` : "",
      gmailCalls ? `G calls ${gmailCalls}` : "",
      outlookCalls ? `O calls ${outlookCalls}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    ```

  - Shows only `G quota`, `G calls`, and `O calls` to keep the UI compact and metric data limited.

Loading and error states:

- While fetching:
  - Displays “Loading runs…”.
- On error:
  - Displays the error message in red.
- When no runs:
  - Displays “No runs found.”

---

## Usage Summary

1. Set `ADMIN_APP_TOKEN` in your environment.
2. Start the dev server.
3. Open `/admin/sync`.
4. Paste the admin token and click `Set token`.
5. Use:
   - “Run sync-tick” to trigger a worker tick.
   - The runs table to monitor:
     - mode, status, stage
     - imported message count
     - compact metrics (`gmailQuotaUnits`, `gmailCalls`, `outlookCalls`)

This admin surface is intended for internal use in development and staging to observe and control the sync engine safely without exposing it to end users.

