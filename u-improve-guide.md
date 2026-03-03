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