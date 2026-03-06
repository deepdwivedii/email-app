# Sync Engine Architecture

This document describes the implemented email sync architecture for Atlas, designed for reliability on serverless platforms (Netlify) and rate-limit safety.

---

## 1. Core Architecture

The sync engine uses a **decoupled, state-based** approach.

### 1.1 State Tracking (Postgres)

- **`sync_runs`**: Tracks user-facing progress (imported count, status, error).
  - Statuses: `queued`, `running`, `paused`, `done`, `error`.
  - Created via `POST /api/sync`.
- **`mailbox_cursors`**: Tracks internal provider state (pagination tokens, history IDs).
  - **Gmail**: `backfill` (search query, page token), `delta` (historyId).
  - **Outlook**: `backfill` (folder pagination links), `delta` (delta links).

### 1.2 Execution Model (Background Functions)

Sync jobs are executed by a **Netlify Background Function** (`netlify/functions/sync-background.ts`) which allows for long-running processes (up to 15 minutes).

- **Endpoint**: `/api/jobs/sync-background`
- **Trigger**: Periodic Cron (e.g., every 15 minutes) or manual Admin trigger.
- **Logic**:
  1. Authenticates using `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
  2. Runs a loop calling `syncWorkerTick()` repeatedly.
  3. Stops after ~14 minutes to avoid platform timeout.

---

## 2. Worker Logic (`syncWorkerTick`)

The worker processes a batch of active sync runs in a round-robin fashion.

**Location**: `src/lib/server/sync-engine.ts`

### 2.1 Batching & Rate Limits

To ensure reliability and avoid timeouts:
- **Gmail**: Fetches **50 messages** per tick.
- **Outlook**: Fetches **50 messages** per tick (`$top=50`).
- **Safety**: Each tick is short (seconds), allowing state to be saved frequently.

### 2.2 Gmail Strategy

1. **Backfill**:
   - Uses `users.messages.list` with `q` (e.g., `-in:chats`) and `maxResults=500`.
   - Slices results into chunks of 50.
   - Fetches metadata (From, To, Subject, Date, List-Unsubscribe) for the chunk.
   - Upserts to `messages` and `inventory`.
2. **Delta (History)**:
   - Uses `users.history.list` with `startHistoryId`.
   - Fetches only new/changed messages.

### 2.3 Outlook Strategy (Graph API)

1. **Backfill**:
   - Iterates folders (`Inbox`, `JunkEmail`).
   - Uses `/me/mailFolders/{id}/messages` with `$top=50`.
   - Saves `@odata.nextLink` to cursor.
2. **Delta**:
   - Uses `/me/mailFolders/{id}/messages/delta`.
   - Handles `@removed` items (soft delete).
   - Saves `@odata.deltaLink`.

---

## 3. Triggering Syncs

### 3.1 User Trigger (Foreground)
- **Endpoint**: `POST /api/sync`
- **Behavior**:
  - Creates/Updates `sync_runs` row.
  - Runs a **short, capped sync** immediately (soft timeout 8s) to give instant feedback.
  - Returns current status to UI.

### 3.2 Background Trigger (Cron)
- **Endpoint**: `POST /api/jobs/sync-background`
- **Behavior**:
  - Starts the 15-minute background loop.
  - Picks up any `queued` or `running` jobs from `sync_runs`.
  - Advances them incrementally.

### 3.3 Admin Trigger (Manual)
- **Page**: `/admin/sync`
- **Behavior**:
  - "Run sync-tick": Runs one cycle of `syncWorkerTick`.
  - "Auto-Run": Simulates a worker loop in the browser for debugging.

---

## 4. Configuration

Required Environment Variables:

- `GMAIL_OAUTH_CLIENT_ID` / `_SECRET`: For Gmail API.
- `MS_OAUTH_CLIENT_ID` / `_SECRET`: For Graph API.
- `SUPABASE_SERVICE_ROLE_KEY`: For background worker database access.
- `ADMIN_APP_TOKEN`: For accessing admin APIs.

---

## 5. Error Handling

- **Soft Errors** (e.g., Network): Retried automatically.
- **Hard Errors** (e.g., `invalid_grant`):
  - Mark run as `error`.
  - Log error message to `sync_runs.error`.
  - Admin UI displays these errors in red.
- **Timeouts**:
  - Worker saves state (cursor) after every 50-message batch.
  - Next run resumes exactly where it left off.
