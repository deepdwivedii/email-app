# Sync Engine v2 (10/10) — Small-Batch Full Import + Delta Sync

This architecture ensures rate-limit safety (token buckets, backoff), idempotency (safe replays), per-folder state tracking, fair scheduling, and a seamless "quick pre-scan" UX.

---

## ⚙️ Constants & API Limits

### Gmail Quota Units

* **Per-User Limit:** 15,000 units/min (Average: 250 units/sec)
* **Per-Project Limit:** 1,200,000 units/min
* **Method Costs:** `messages.get` (5), `messages.list` (5), `history.list` (2)
* **Safe Target:** ~40 `messages.get` per second per user.

### Microsoft Graph (Outlook)

* **Page Sizes:** Default is 10; `$top` allows 1–1000.
* **Concurrency:** Max 1–2 concurrent requests per mailbox to avoid severe throttling.

---

## Step 0: Initialize Database State

Use these tables to track background progress without long-lived API requests.

### 0.1 `sync_runs` (Progress & UX State)

* **Fields:** `id`, `mailboxId`, `userId`, `mode` (quick/full/delta), `status` (queued/running/paused/done/error/needs_reauth), `stage` (listing/fetching/upserting/aggregating), counters (`importedCount`, `updatedCount`, `deletedCount`, `domainCount`), `error`, timestamps.

### 0.2 `mailbox_cursors` (Resumable Checkpoints)

* **Fields:** `mailboxId` (PK), `userId`, `provider` (gmail/outlook/imap), `backfill` (JSONB), `delta` (JSONB), `updatedAt`.

> **Critical Guardrail (Idempotency):** Add a unique index for message identity per mailbox: `UNIQUE(mailboxId, providerMsgId)`. This makes retries inherently safe.

---

## Step 1: Decouple the Architecture

Separate user triggers from the heavy lifting. **Never process an entire mailbox in one HTTP request.**

* `POST /api/sync/start`: User-triggered. Creates/updates `sync_runs`, initializes cursor, returns `200 OK` immediately.
* `GET /api/sync/status`: Frontend polls this for the progress bar.
* `POST /api/jobs/sync-tick`: Internal worker endpoint (protected by secret). Processes **one chunk** per mailbox, updates the DB, and exits.

---

## Step 2: Rate Limits & Backoff Strategies

1. **Gmail Token Buckets:** * *Per-user:* Cap at 200 units/sec.
* *Project global:* Cap at 10,000 units/sec. Deduct tokens before calling; pause if insufficient.


2. **Outlook Safe Paging:** Hardcode `$top=100`. Process 1–3 pages per folder per tick.
3. **Universal Backoff:** On `429/503` errors, respect the `Retry-After` header + jitter. If missing, use exponential backoff (1s, 2s, 4s, 8s... up to 60s) + jitter.

---

## Step 3: Gmail Full Sync (Backfill)

**Cursor State (`mailbox_cursors.backfill`)**

```json
{
  "type": "gmail_backfill",
  "q": "-in:chats",
  "pageToken": null,
  "indexInPage": 0,
  "done": false
}

```

**Worker Tick logic:**

1. **Listing:** Call `users.messages.list(maxResults=500, pageToken, q)`.
2. **Fetching:** Slice the IDs from `indexInPage` to `indexInPage + BATCH_GET` (e.g., 100-200). Call `users.messages.get` for metadata only.
3. **Upserting:** Bulk upsert the slice into your DB. Update `indexInPage` (or advance `pageToken` if the page is finished).
4. If no `nextPageToken` remains, mark `done=true`.

---

## Step 4: Gmail Delta Sync (Polling)

**Cursor State (`mailbox_cursors.delta`)**

```json
{
  "type": "gmail_history",
  "startHistoryId": "123",
  "lastHistoryId": "123",
  "lastDeltaAt": "2026-03-03T00:00:00Z"
}

```

**Worker Tick logic (Runs every 10–30 mins):**

1. Call `users.history.list(startHistoryId = lastHistoryId)`.
2. Fetch metadata only for the new/changed IDs.
3. Bulk upsert and update `lastHistoryId`.
*Fallback:* If Gmail returns "history too old", trigger a partial backfill repair (e.g., `q="newer_than:30d"`), then reset the history ID.

---

## Step 5: Outlook Full Sync (Backfill)

**Cursor State (`mailbox_cursors.backfill`)**

```json
{
  "type": "graph_backfill",
  "folders": {
    "inbox": { "nextLink": null, "done": false },
    "junk":  { "nextLink": null, "done": false }
  }
}

```

**Worker Tick logic:**

1. If `nextLink` exists, GET it. Else, GET `/me/mailFolders/{folderId}/messages?$top=100`.
2. Bulk upsert messages (map Graph ID to `providerMsgId`).
3. Save the new `@odata.nextLink`. If missing, mark the folder `done=true`.

---

## Step 6: Outlook Delta Sync

**Cursor State (`mailbox_cursors.delta`)**

```json
{
  "type": "graph_delta",
  "folders": {
    "inbox": { "deltaLink": null, "nextLink": null },
    "junk":  { "deltaLink": null, "nextLink": null }
  }
}

```

**Worker Tick logic (Runs every 10–30 mins):**

1. Call `nextLink` (if paging) -> else `deltaLink` -> else initial `/messages/delta` URL.
2. Upsert new/changed messages.
3. If an item has `@removed`, increment `deletedCount` and soft-delete in DB.
4. Save the resulting `@odata.deltaLink` or `@odata.nextLink`.

---

## Step 7: Defer Outlook Headers (Crucial for Speed)

* **During background sync:** Store only `from`, `subject`, `receivedDateTime`, `internetMessageId`, `folder`, and `isSpam`.
* **On-Demand:** When a user expands a domain in the UI, fetch the last 3–5 messages dynamically via `GET /me/messages/{id}?$select=internetMessageHeaders` to parse the `List-Unsubscribe` links.

---

## Step 8: Concurrency & Scheduling

* **Fairness:** Process max 50 mailboxes globally per worker cycle using round-robin. Do not let one massive inbox starve the queue.
* **Adaptive Tuning:** If you hit `userRateLimitExceeded` (Gmail), reduce the batch size. If you hit `429` (Graph), lower concurrency and obey `Retry-After`.

---

## Step 9: The UX Flow

1. **Immediate pre-scan:** On connect, synchronously fetch the first 50 messages (Gmail list+get; Outlook inbox list) and populate the UI instantly.
2. **Background continuation:** Kick off the worker to handle the rest. Show a persistent "Import in progress" card with a live counter and pause/continue controls.
3. **Resilience:** If the user closes the tab, the worker finishes the job.

---

### Acceptance Checklist

* [ ] 5,000-message import completes with zero duplicates.
* [ ] Worker can be killed mid-import and cleanly resumes from the cursor.
* [ ] 429 Throttle events trigger a pause and auto-recover.
* [ ] Outlook soft-deletes work via `@removed` delta flags.
* [ ] Users see initial data in <10 seconds.