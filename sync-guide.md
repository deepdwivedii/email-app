# Atlas UX v2 — End-to-End Flow + Navigation Optimization (Landing → Login → Onboarding → Daily Use)

This doc redesigns your UX **from first visit to recurring use**, removes/merges redundant areas, and makes the product feel like a clear “Connect → Scan → Review → Act” dashboard.

---

## Goals (what “good” looks like)
- **Time to first value < 2 minutes:** user connects mailbox, runs a quick scan, sees meaningful results.
- **No confusion about Sync:** user always knows *what’s being scanned*, *how much is scanned*, and *what to do next*.
- **Navigation is outcome-first:** “Subscriptions” and “Accounts” are the product. Everything else supports them.
- **Minimize pages:** fewer destinations, more powerful pages with tabs/sections.

---

## Proposed Information Architecture (IA)

### Keep (core outcomes)
- **Overview** (home)
- **Subscriptions** (domain-based cleanup)
- **Accounts** (inferred services + actions)
- **Tasks** (follow-ups)
- **Settings** (connections, privacy, export/delete, advanced)

### Merge / Move (remove redundancy)
- **Move Mailboxes into Settings → Connections**
  - Keep `/mailboxes` route but make it a redirect to `/settings/connections`.
- **Demote /messages to Advanced**
  - Raw messages is for power users / debugging. Move it to `/settings/advanced/messages` (or `/advanced/messages`).
  - Remove it from top nav.

### Remove (or repurpose)
- Remove “Peek the dashboard” CTA language (it implies a demo view that you don’t really offer).
- Remove `/settings` link from logged-out footer (replace with `/privacy` + `/security` public pages).
- Replace separate `/login` and `/signup` with a single `/auth` (tabs).

---

## Top Navigation (logged in)

### Desktop header nav (5 items max)
1. **Overview**
2. **Subscriptions**
3. **Accounts**
4. **Tasks**
5. **Settings**

### Mobile
- Bottom nav with 4 icons:
  - Overview, Subscriptions, Accounts, Tasks
- Settings in top-right menu

---

## End-to-End UX Flow (Step-by-step)

## 1) Landing (`/`)
### What user needs to understand in 10 seconds
- What it does: “Find subscriptions + accounts across inboxes”
- Why trust it: “We read headers only (default), never email body” (if true)
- How it works: **Connect → Scan → Review → Act**

### Changes to landing layout
- Primary CTA: **Get started free**
- Secondary CTA: **Sign in**
- Add a small “How it works” 4-step strip directly under the hero:
  1) Connect inbox  
  2) Scan (quick or full)  
  3) Review subscriptions + accounts  
  4) Unsubscribe / take actions  
- Add a privacy micro-banner near CTA:
  - “Default: header-only indexing. You control what we store.”
- Logged-out footer links:
  - Privacy, Security, Terms, Support
  - (No Settings link)

**Success criteria**
- Click-through rate improves
- Fewer users bounce on auth due to privacy uncertainty

---

## 2) Auth (`/auth`) — One page, two tabs
### Replace
- `/login` + `/signup` → `/auth` with tabs:
  - **Sign in**
  - **Create account**

### Sign-in tab
- Email + password
- Magic link (optional)
- OAuth buttons (Google/Microsoft/GitHub if you keep)

### Sign-up tab
- Show a short line **before** submit:
  - “You’ll get a confirmation email. After confirming, you’ll return here to sign in.”

### Loading / redirect states
- Never render a blank screen
- Always show:
  - “Checking your session…” spinner
  - “Redirecting…” spinner

**Success criteria**
- Reduced confusion during “blank” transitions
- Higher completion for sign-up confirmation step

---

## 3) First-time Onboarding (New: `/onboarding`)
After first successful login, route user to onboarding until they complete the first scan.

### Onboarding layout
- Left: checklist (always visible)
- Right: step content

### Checklist
1. **Connect an inbox**
2. **Choose scan type**
3. **Run scan**
4. **Review Subscriptions**
5. **Review Accounts**
6. **Set ongoing sync** (optional, if/when background jobs exist)

### Step 1 — Connect inbox
- Show Gmail + Outlook cards
- Beneath buttons: “We request read-only metadata access by default.”

### Step 2 — Choose scan type (VERY IMPORTANT)
- **Quick Scan (recommended first)**
  - e.g., last 7–30 days or first N pages
  - “Takes ~10–30 seconds”
- **Full Import**
  - “Scans all mail (can take minutes). Runs in the background.”

### Step 3 — Run scan
- Big “Start scan” button
- Show a progress panel:
  - Mailbox: Gmail / Outlook
  - Mode: Quick / Full
  - Imported: X messages
  - Domains found: Y
  - Accounts inferred: Z
  - Errors: # (click to view)
- CTA after quick scan finishes:
  - **Review Subscriptions**
  - **Review Accounts**

### Exit onboarding
- Once user has:
  - Connected at least 1 inbox
  - Completed at least 1 scan
- Route them to **Overview**

**Success criteria**
- Users don’t get lost after connecting inbox
- Users understand why scan might take time

---

## 4) Overview (`/overview`) — Replace/rename `/dashboard`
### Purpose
A “home base” with status + next actions, not just a table.

### Overview sections (top-to-bottom)
1. **Status strip (always visible)**
   - Connected inboxes count
   - Last sync time
   - Scan mode selector (Quick / Full)
   - Button: **Sync now**
   - If merged view exists, show badge “Merged”
2. **Insights summary**
   - Subscriptions detected
   - New senders this week
   - Accounts inferred
   - Unsubscribed count
3. **Recommended next actions**
   - “Top 10 noisy subscriptions”
   - “High-confidence accounts needing review”
4. **Recent activity**
   - recent unsubscribes
   - recent tasks created
   - recent sync events

### What changes from today
- Subscriptions table moves out of Overview (it’s too heavy for a “home” page)
- Overview becomes a dashboard with clear next steps

**Success criteria**
- Overview is useful after day 1
- Users don’t feel forced into Accounts immediately

---

## 5) Subscriptions (`/subscriptions`) — Make this the primary cleanup view
This becomes the “domain inventory” page (instead of only living on dashboard).

### Layout
- Top: search + filters
  - mailbox selector (All / per mailbox)
  - category (promotions/social/updates if available)
  - status (subscribed/unsubscribed/ignored)
  - volume slider (min emails)
- Main: domain list (current DomainTable)
- Right-side panel (or expandable row): recent messages

### Actions (make them feel safe)
- **Unsubscribe**
  - After action: toast + “Undo” (where feasible)
  - Show result state: “Requested” vs “Confirmed”
- **Mark as Safe**
  - Inline explanation tooltip: “Hide this sender from cleanup suggestions.”

### Add bulk actions
- Checkbox select → bulk unsubscribe / bulk mark-safe

**Success criteria**
- Users can clean subscriptions without bouncing around pages
- Fewer accidental actions

---

## 6) Accounts (`/accounts`) — Outcome-driven service management
### Improve meaning
- Add 1-line explanation at top:
  - “Accounts are services we infer from your email signals (newsletters, receipts, security emails).”

### Improvements
- Stronger filters:
  - confidence level
  - category (shopping, finance, social, etc.)
  - identity/mailbox
- Account cards show:
  - service name, domain
  - confidence
  - last seen
  - **Primary action** (“Review”, “Unsubscribe”, “Close account”, etc.)
- Clicking opens Account Detail

### Account detail (`/accounts/:id`)
- Keep evidence, but:
  - Move evidence into a collapsible “Why we think this” section
  - Put actions at the top, not below evidence

**Success criteria**
- Accounts feels understandable to non-technical users
- Evidence supports trust but doesn’t block action

---

## 7) Tasks (`/tasks`) — Make follow-up actionable
### Improvements
- Show the related account/service under each task title
- Highlight overdue tasks visually
- Add quick bulk action:
  - select → “Mark done”

**Success criteria**
- Tasks feels connected to Accounts/Subs, not a separate app

---

## 8) Settings (`/settings`) — Sub-pages, not one long page
### New settings structure
- `/settings/connections`
- `/settings/privacy`
- `/settings/data`
- `/settings/advanced`

#### Connections (replaces `/mailboxes`)
- List inboxes with:
  - last sync, health
  - set active / merged view
  - reconnect / disconnect
- Sync frequency:
  - If background sync NOT implemented: either hide OR label “UI-only (coming soon)”
  - If implemented: make it real and show next scheduled run

#### Privacy
- Explain:
  - header-only by default
  - what’s stored
  - scopes
  - retention controls (if added)

#### Data
- Export data
- Delete my data (danger zone)

#### Advanced
- Raw messages view (moved from `/messages`)
- Diagnostics link

**Success criteria**
- Connections is easy to find
- Advanced tools don’t clutter main UX

---

## 9) Error/Empty States (global improvements)
### Everywhere
When a list is empty, show:
- What happened
- What to do next
- One direct button to fix it:
  - “Go to Overview and Sync”

### Auth-required access
If logged-out user hits an auth page accidentally:
- Show a friendly message:
  - “You need to sign in to view this.”
  - Button: “Sign in”

---

## 10) Sync UX (the missing piece that fixes confusion)
Sync should never feel like “it did something… maybe?”

### Required UI elements
- Sync mode selector: **Quick** / **Full**
- Progress panel (persisted):
  - messages imported
  - domains updated
  - accounts inferred
  - current mailbox being scanned
  - errors with details
- “Continue full import” button if the scan stopped or is chunked
- “Runs in background” explanation when full import is selected

### Required backend support (to support UX)
- Store sync runs + checkpoints in DB:
  - status: idle/running/paused/error/done
  - imported count
  - cursor/checkpoint
- Full import should run in chunks (avoid API route timeouts)

---

## Route Map (Old → New)

| Current Route | Proposed | Action |
|---|---|---|
| `/` | `/` | improve content + CTA + privacy + steps |
| `/login`, `/signup` | `/auth` | merge into single auth page |
| `/dashboard` | `/overview` | rename + redesign as true dashboard |
| *(domain table on dashboard)* | `/subscriptions` | move inventory table to its own page |
| `/mailboxes` | `/settings/connections` | move & redirect old route |
| `/messages` | `/settings/advanced/messages` | demote to advanced |
| `/settings` | `/settings/*` | split into sub-pages |
| `/privacy` | `/privacy` | keep public |
| *(none)* | `/onboarding` | add a guided first-run flow |

---

## Redundant UI to remove or simplify
- Remove “Peek the dashboard” phrasing (replace with “Sign in”)
- Remove top nav item “Messages”
- Remove footer “Settings” link when logged out
- Remove confusing “frequency” toggle unless it’s truly implemented (or label it clearly)

---

## Recommended Screen-by-Screen Copy (microcopy upgrades)
- Connect inbox: “We read headers only by default—never message content.”
- Sync button:
  - Quick: “Scan recent mail (fast)”
  - Full: “Import all mail (runs in background)”
- Subscriptions:
  - “Mark as Safe: hide this sender from cleanup suggestions.”
- Accounts:
  - “Accounts are inferred services. Confidence indicates how certain we are.”

---

## Implementation Checklist (practical to build in order)

### Week 1: UX clarity + page consolidation
- [ ] Build `/auth` page (tabs), redirect `/login` and `/signup`
- [ ] Add `/onboarding` wizard
- [ ] Create `/overview` (rename from `/dashboard`)
- [ ] Create `/subscriptions` page and move DomainTable there
- [ ] Move `/mailboxes` into `/settings/connections` and redirect
- [ ] Move `/messages` into `/settings/advanced/messages` and remove from main nav
- [ ] Fix empty states with “Go to Overview → Sync”

### Week 2: Sync UX + progress
- [ ] Add “Quick vs Full” scan selector
- [ ] Add persistent sync status panel
- [ ] Add DB tables for sync runs + checkpoints
- [ ] Update sync API to support pagination/backfill chunks
- [ ] Add “Continue full import” UX

### Week 3: Polish
- [ ] Tooltips + explanations (Mark safe, merged view, confidence)
- [ ] Inline auth error handling and “Checking your session…” loader
- [ ] Bulk actions in Subscriptions
- [ ] Task list shows related account + overdue styling

---

## Acceptance Tests (how you know the UX is better)
1. New user can go from landing → connected inbox → results **without guessing** what to do.
2. Sync shows progress and never looks “stuck” or “mystical.”
3. Main nav has ≤ 5 items and all are outcome pages.
4. Users can clean subscriptions from one dedicated page.
5. Mailbox management is discoverable under Settings, not a separate “app section.”

---

* **First:** Make Gmail + Outlook full backfill + delta rock-solid (best UX and reliability).

give me a detailed guide which should be upto date as of 3 March 2026

make a .md file which i can give to my AI IDE 
Thought for 4m 50s

The guide below is based on the latest official docs I checked (Google Gmail API + Microsoft Graph) as of 3 Mar 2026.

# Atlas Email Dashboard — Full Import + Delta Sync Guide (as of 2026-03-03)

This document is written for an AI IDE to implement **reliable full mailbox import + ongoing incremental sync** for **Gmail + Outlook** in your current Atlas codebase (Next.js + Supabase), while keeping your current “header-only indexing” privacy posture.

It also includes an optional **IMAP connector plan** for “all providers”, and UX changes needed so users understand what’s happening.

---

## 0) Current reality in your repo (baseline)

### What your current `/api/sync` does today
- Gmail: calls `users.messages.list` with `maxResults=50`, then fetches each message metadata.
- Outlook: calls Graph `/me/messages` with `$top=20`, then fetches each message.
- No pagination ⇒ you only ever import ~20–50 messages.
- **Bug/mismatch:** The code currently **requires the `mb` cookie** and returns 401 if it’s missing, even though the logic below suggests “sync all mailboxes when cookie missing”. Fix this first.

### The correct sync model
You need **two modes** per mailbox:
1) **Backfill (one-time, chunked):** import all messages (or all messages in selected folders)
2) **Delta (forever):** import only changes since last checkpoint

And you must run backfill **in background chunks** to avoid serverless/route timeouts.

---

## 1) UX you must implement (or users will think it’s broken)

### UX requirement: Quick Scan vs Full Import
Add a scan mode selector everywhere “Sync” appears:
- **Quick Scan (recommended):** imports recent mail only (fast first value)
- **Full Import:** imports the whole mailbox (slow; runs in background; resumable)

### UX requirement: Persistent progress card
On the main home page (rename `/dashboard` → `/overview` later if you want), show a Sync Status card:
- State: `idle | running | paused | needs_reauth | error | done`
- Mode: `quick | full`
- Progress: `messagesImported`, `domainsFound`, `accountsInferred`
- Current mailbox and current stage (listing / fetching / upserting / aggregating)
- Buttons:
  - `Sync now` (quick)
  - `Start full import`
  - `Continue full import`
  - `Pause`
  - `Reconnect mailbox` (if auth fails)
  - `View details` (errors, last run)

### UX requirement: No redundant pages
- Move `/mailboxes` into `/settings/connections` and redirect `/mailboxes` → `/settings/connections`.
- Demote `/messages` to Advanced (e.g. `/settings/advanced/messages`) and remove from top nav.
- Move the domain table (subscriptions) out of the dashboard into `/subscriptions` (or at least add a dedicated page).

---

## 2) Data model changes (Supabase)

### 2.1 Must-have new tables (sync engine v2)
Create these tables (names are suggestions; keep consistent casing with your existing schema):

#### `sync_runs`
Tracks each run (quick or full) per mailbox.
- `id` (text, pk)
- `userId` (text)
- `mailboxId` (text)
- `mode` (`quick` | `full` | `delta`)
- `status` (`running` | `paused` | `done` | `error` | `needs_reauth`)
- `startedAt` (bigint)
- `finishedAt` (bigint nullable)
- `stage` (text: `listing`, `fetching`, `upserting`, `aggregating`)
- `importedCount` (int)
- `domainCount` (int)
- `accountEvidenceCount` (int)
- `error` (text nullable)
- `cursorSnapshot` (jsonb nullable) — optional, for debugging

#### `mailbox_cursors`
Stores resumable cursor state for backfill and delta.
- `mailboxId` (text, pk)
- `userId` (text)
- `provider` (`gmail` | `outlook` | `imap`)
- `backfill` (jsonb) — checkpoint for “full import”
- `delta` (jsonb) — checkpoint for “incremental”
- `updatedAt` (bigint)

> Why separate table? Because Outlook delta is *per folder*, and Gmail uses historyId + sometimes paging. Storing JSON here is simplest.

### 2.2 Recommended additions to `messages`
Add fields needed for spam + folder segmentation:
- `folder` (text nullable) — Outlook folder name/id; Gmail can store “INBOX/SPAM” derived flags
- `labelIds` (jsonb nullable) — Gmail label IDs (including SPAM)
- `isSpam` (bool default false)
- `providerThreadId` (text nullable) — Gmail threadId if you want
- `internetMessageId` (text nullable) — Graph header correlation
- indexes:
  - unique `(mailboxId, providerMsgId)`
  - `(mailboxId, receivedAt)`
  - `(mailboxId, rootDomain)`
  - `(mailboxId, isSpam)`

### 2.3 RLS policies
For every new table:
- Enable RLS
- Allow the authenticated user to select/insert/update/delete rows where `userId = auth.uid()`

---

## 3) Backend architecture (how to avoid timeouts)

### 3.1 Add “job” endpoints (server-only)
Do NOT run full import inside the user-click HTTP request to `/api/sync` end-to-end.

Instead:

#### Public endpoints (user-triggered)
- `POST /api/sync/start`
  - body: `{ mailboxId?, mode: "quick"|"full" }`
  - creates/updates `sync_runs`
  - kicks off one chunk immediately (optional) and/or schedules worker
- `GET /api/sync/status?mailboxId=...`
  - returns current `sync_runs` + progress
- `POST /api/sync/pause`
- `POST /api/sync/continue`

#### Worker-only endpoint (protected)
- `POST /api/jobs/sync-tick`
  - Requires `X-Internal-Secret`
  - Pops “due” jobs and processes **one chunk per mailbox**
  - Updates cursor and sync_runs
  - Repeats on next cron tick until done

### 3.2 Pick one scheduling approach (choose based on hosting)
Option A (simplest): **Vercel Cron** hits `/api/jobs/sync-tick` every 1–5 minutes  
Option B: **Supabase scheduled function** triggers your worker logic  
Option C: A real queue/worker (BullMQ/Redis) if you want high scale

**Rule:** each worker execution should process at most:
- N messages (e.g. 200–1000) OR
- a time budget (e.g. 10–20 seconds)
Then persist cursor and exit cleanly.

---

## 4) Fix your current sync route first (minimum correctness)

### 4.1 Remove the early cookie requirement
In `src/app/api/sync/route.ts` you currently do:
- `if (!currentMailboxId) return 401;`

Remove that and allow:
- if cookie present: sync active mailbox
- if cookie absent: sync all mailboxes for the user (or return a friendly 400 asking user to pick)

### 4.2 Add pagination (even before background jobs)
Even if you keep `/api/sync` for quick scan, it must paginate.

---

## 5) Gmail: full import + delta sync (metadata-only)

### 5.1 Scopes (keep privacy-forward)
- `https://www.googleapis.com/auth/gmail.metadata` (enables metadata + labels; no bodies)
- `openid email`

### 5.2 Backfill (full import) algorithm (chunked)
Use `users.messages.list` with:
- `maxResults=500` (max allowed)
- `pageToken` for pagination
- optional query `q=` to bound ranges (recommended for stability)

#### Cursor shape (store in `mailbox_cursors.backfill`)
```json
{
  "type": "gmail_backfill",
  "pageToken": "....",
  "q": "-in:chats", 
  "completed": false,
  "lastUpdatedAt": 0
}

Call:

GET https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500&pageToken=...&q=...

For each returned message id:

Fetch metadata:

GET .../messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post

Parse headers → upsert into DB

Save nextPageToken into cursor

If no nextPageToken, mark backfill complete

5.3 Delta sync using history.list (recommended)

Store a historyId after a successful sync.

You can store the latest historyId from a list/get response or from the sync guide approach.

Cursor shape (store in mailbox_cursors.delta)
{
  "type": "gmail_history",
  "startHistoryId": "1234567",
  "lastHistoryId": "1234567",
  "lastDeltaAt": 0
}
Delta pseudocode

Call:

GET https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=...

For each history record, collect new/changed message IDs

Fetch metadata for those IDs and upsert

Store returned historyId as new checkpoint

If Gmail returns 404 (history too old), fall back to full import

5.4 Optional: push notifications (later, big win)

Use Gmail push notifications:

Call users.watch and receive changes via Pub/Sub.

Important: watch must be renewed at least every 7 days; recommended daily renewal.
Store expiration and run a daily renewal job.

6) Outlook/Microsoft Graph: full import + delta sync (recommended)
6.1 Scopes

Delegated: Mail.Read, offline_access, openid, email, profile

If you later want actions like move/delete/mark spam: Mail.ReadWrite (not required for read-only import)

6.2 Decide folders you track (minimum)

Start with two folders:

Inbox

Junk Email (spam)

Later you can add:

Archive

Sent (optional)

Custom folders (advanced)

6.3 Backfill algorithm (chunked)

Graph paging uses @odata.nextLink.
Use folder-scoped list:

GET /me/mailFolders/{folderId}/messages?$select=...&$top=50

Cursor shape:

{
  "type": "graph_backfill",
  "folders": {
    "inbox": { "nextLink": "https://graph.microsoft.com/...skiptoken=..." , "done": false },
    "junkemail": { "nextLink": null, "done": false }
  }
}

Chunk pseudocode (per folder):

If nextLink exists, call it; else call initial list URL

Process messages and upsert

If response includes @odata.nextLink, store it and continue next tick

Else mark folder done

When all folders done, mark backfill complete

6.4 Delta sync (correct way)

Use message delta per folder:

GET https://graph.microsoft.com/v1.0/me/mailFolders/{id}/messages/delta?$select=...&$top=50

Important constraints:

Delta is per-folder; if you want changes in a folder hierarchy you must track each folder you care about.

Delta supports $select, $top, $expand and limited $filter (receivedDateTime ge/gt).

Cursor shape:

{
  "type": "graph_delta",
  "folders": {
    "inbox": { "deltaLink": "https://graph.microsoft.com/...deltatoken=...", "nextLink": null },
    "junkemail": { "deltaLink": "...", "nextLink": null }
  }
}

Delta pseudocode:

For each tracked folder:

If nextLink exists: call it (continue paging through delta)

Else if deltaLink exists: call it (get changes since last checkpoint)

Else: call initial delta URL

Process value[]:

New/updated messages: upsert metadata

Deleted messages: handle @removed entries (mark deleted or ignore)

When response contains @odata.deltaLink, store it and clear nextLink

If response contains @odata.nextLink, store it and keep going next tick

6.5 Getting List-Unsubscribe on Graph

You currently fetch internetMessageHeaders per message (good).
Keep doing:

GET /me/messages/{id}?$select=...,internetMessageHeaders
Then parse:

List-Unsubscribe

List-Unsubscribe-Post

7) Spam import (required if your dashboard includes spam)
Gmail

In metadata-only mode, labels are available.

If labels include "SPAM" then set:

isSpam = true

folder = "SPAM" (optional)

store labelIds JSON

Outlook

Messages in Junk folder should set isSpam=true and folder="junkemail"

Then build:

/spam page (top spam domains, spam volume over time)

spam rate per domain in rollups

8) Performance + correctness rules (don’t skip)
8.1 Idempotency / dedupe

Ensure unique constraint (mailboxId, providerMsgId)

Always upsert, never blind insert in sync loops

8.2 Rate limits & retries

Keep your fetchWithRetry wrapper

Add exponential backoff on 429/503

Store “needs_reauth” if refresh fails

8.3 Don’t re-fetch expensive per-message data in backfill

For Gmail: you must call per-message get to read headers; keep maxResults high and chunk.

For Outlook: you can list messages with $select for most fields, but you still need internetMessageHeaders if you rely on List-Unsubscribe → fetch per-message only when needed:

Approach: list first; only fetch headers for:

messages that look like newsletters/promotions (based on subject/from), OR

sample last N messages per domain to find List-Unsubscribe later

8.4 Compute-heavy inference

Your classifier and evidence inference runs per message today.
For full import this can be slow.
Recommended approach:

During backfill: store message + minimal domain stats

Run account inference in a second pass (or throttle):

e.g. infer only for 1 message per domain per day during backfill