Atlas App – Implemented Features (Current Codebase)

## Core Application Shell
- Global layout with sticky header, logo, main navigation, and toast system.
- Auth context (`AuthProvider`) providing `user` and `loading` to client components.
- Marketing landing page at `/` with hero copy and CTA links to Privacy and Settings.

## Authentication & Sessions
- Email/password signup and login via Supabase Auth.
- Magic-link login (email OTP) with redirect back to the app.
- OAuth login via Supabase providers for Google, GitHub, and Azure.
- Automatic redirect away from `/login` and `/signup` when already authenticated.
- `useRequireAuth` hook to protect pages and redirect unauthenticated users to `/login`.

## Mailbox Connection & Management
- Gmail OAuth flow using Google OAuth2 client:
  - Start endpoint: `/api/oauth/google/start`.
  - Callback: `/api/oauth/google/callback`.
  - Fetches Gmail profile, stores encrypted token blob, and sets `mb` cookie.
- Outlook/Microsoft OAuth flow using `@azure/msal-node`:
  - Callback: `/api/oauth/microsoft/callback`.
  - Fetches Graph `/me`, stores encrypted token blob, and sets `mb` cookie.
- Mailbox listing endpoint `/api/mailboxes`:
  - Returns mailboxes and identities for the current user.
  - Validates tokens against Gmail and Graph, refreshing Outlook tokens when needed.
  - Marks mailbox health as `active` or `error` with status text.
- Active mailbox selection via `/api/mailboxes/active`:
  - Sets `mb` cookie and optional `mb_mode=merged` for merged view.
- Mailbox disconnect via `/api/mailboxes/[id]/disconnect`:
  - Authenticates, verifies ownership, deletes messages and inventory, then mailbox row.

## Mailbox UI (/mailboxes)
- Lists all connected mailboxes with:
  - Provider icons (Gmail/Outlook).
  - Connection time and last sync timestamp.
  - Health indicators and tooltip details.
- Actions per mailbox:
  - Set Active (scopes sync to this mailbox).
  - Disconnect (removes mailbox and its data).
  - Reconnect (re-trigger OAuth flow).
  - Sync Now (sets active then POSTs to `/api/sync`).
  - Set frequency (localStorage-based manual/15m/30m/1h toggle).
- Global merged view toggle that sets merged mode on the active mailbox.

## Sync Engine (/api/sync)
- **Background Sync (Netlify Functions)**:
  - Dedicated background function `netlify/functions/sync-background.ts` running up to 15 minutes.
  - Triggered via `/api/jobs/sync-background` (requires `SUPABASE_SERVICE_ROLE_KEY` internally).
  - Uses `syncWorkerTick` to process mailboxes in round-robin batches (50 items/tick).
  - Bypasses RLS using a service role Supabase client for reliable background execution.
- **Manual/Foreground Sync**:
  - `POST /api/sync` triggers an immediate, shorter sync run (capped execution time).
- **Gmail Sync Logic**:
  - Uses stored encrypted tokens with `google-auth-library`.
  - Batch size reduced to 50 messages/tick for reliability on serverless.
  - Fetches recent message IDs and header metadata only.
  - Writes `messages` rows with From/To/Subject/Date/List-Unsubscribe headers.
  - Maintains `inventory` per root domain with counts and last seen timestamps.
- **Outlook Sync Logic**:
  - Uses Graph API `/me/messages` and `/me/messages/{id}`.
  - Batch size reduced to 50 messages/tick.
  - Refreshes tokens via Microsoft OAuth2 if needed.
  - Writes messages and updates inventory per domain similar to Gmail.
- **Account Inference**:
  - For each message, calls classifier and evidence/inference logic to:
    - Record `accountEvidence` with signals and weights.
    - Upsert `accounts` with confidence scores and explanations.
  - Updates `lastSyncAt` on mailboxes.

## Admin Console (/admin/sync)
- Protected by `ADMIN_APP_TOKEN` (via `x-admin-token` header).
- **Sync Monitor**:
  - Lists recent sync runs with status, stage, imported count, and metrics.
  - Displays full error messages for failed runs.
- **Controls**:
  - "Run sync-tick" button to manually trigger a single worker tick.
  - "Auto-Run (5s)" toggle to continuously trigger ticks from the UI for testing/debugging.

## Dashboard (/dashboard)
- Auth-protected overview page for:
  - Connecting initial Gmail/Outlook mailbox.
  - Manually triggering sync.
- Reads inventory (`/api/inventory`) and mailboxes (`/api/mailboxes`).
- Handles OAuth return query params to:
  - Show success toast when connected.
  - Show error toast when connection fails.
- Displays:
  - Connected mailboxes with health and sync controls.
  - Connect-another-mailbox card when at least one is connected.
  - Guidance card prompting “Run first sync” when there is a mailbox but no inventory.
  - Domain inventory table when domains are present.

## Inventory & Subscriptions
- Inventory endpoint `/api/inventory`:
  - Authenticated access only.
  - Filters inventory by current user and optional query params.
  - For each inventory row, fetches up to 5 recent messages for that domain.
  - Returns domain objects with counts, last seen, unsubscribe state, and recent emails.
- Domain table UI component:
  - Mobile and desktop views listing all domains.
  - Shows domain, message count, last seen, category, and subscription status.
  - Row expansion to show recent emails from that domain.
- Unsubscribe actions:
  - Domain-level unsubscribe button sending POST to `/api/unsubscribe`.
  - After success, marks domain unsubscribed in local state.
- Mark-as-safe:
  - “Mark as Safe” action for a domain sending POST to `/api/inventory/[id]/mark` with status `ignored`.

## Unsubscribe API (/api/unsubscribe)
- Parses `List-Unsubscribe` header into HTTP and mailto targets.
- Implements RFC 8058 one-click unsubscribe when possible:
  - Uses POST with `List-Unsubscribe: One-Click` when requested.
  - Falls back to GET for non-one-click URLs.
- On success:
  - Marks associated inventory row ignored.
  - Writes `actionLogs` records for HTTP or mailto execution.
- Returns structured status (`ok`, `ack`, or `noop`).

## AI-Assisted Unsubscribe Suggestion
- AI flow defined in `src/ai/flows/suggest-unsubscribe-domain.ts`:
  - Uses Genkit with an OpenRouter-hosted model.
  - Takes From/To/Subject/List-Unsubscribe and existing subscription domains.
  - Returns suggested root domain, confidence score, and reasoning.
- API endpoint `/api/ai/suggest-domain`:
  - Validates input and calls AI flow.
  - Returns suggestion JSON or error.
- UI integration:
  - `EmailDetailRow` shows recent emails for a domain plus a “Suggest” button.
  - `SuggestUnsubscribeDialog`:
    - Calls the AI endpoint.
    - Displays suggested domain, confidence, and reason.
    - Offers a one-click unsubscribe using the email’s List-Unsubscribe headers and `/api/unsubscribe`.

## Accounts Feature
- Accounts listing API `/api/accounts`:
  - Authenticated and scoped to current user via `userid`.
  - Supports filters: `emailIdentityId`, `category`, `status`, `minConfidence`.
  - Returns accounts mapped to typed fields (service name, domain, confidence, timestamps).
- Accounts page `/accounts`:
  - Filter chips for category and identities (from mailboxes).
  - Shows cards with:
    - Service name and domain.
    - Confidence badge (High/Medium/Low).
    - Last seen date and category badge.
  - Actions:
    - Open account detail.
    - Trigger unsubscribe for account via `/api/accounts/:id/unsubscribe` and `/api/accounts/:id/actions`.
    - Create a review task linked to the account.
- Account detail API `/api/accounts/:id`:
  - Auth and ownership checks.
  - Returns account plus ordered evidence rows.
- Account detail page `/accounts/[id]`:
  - Shows service name, domain, confidence percentage, last seen.
  - Displays account explanation text.
  - Lists evidence cards with type, excerpt, weight, and timestamp.
  - Actions:
    - Open service (logs action and navigates to `https://serviceDomain`).
    - Unsubscribe for this account (fetches unsubscribe info then posts action).
    - Create review task with optional custom title.
- Unsubscribe helper `/api/accounts/:id/unsubscribe`:
  - Finds the inventory row for the account’s service domain.
  - Searches recent messages for that domain to locate a message with List-Unsubscribe.
  - Returns inventory id and unsubscribe headers for use by actions.
- Account actions `/api/accounts/:id/actions`:
  - Supports action types (`unsubscribe`, `open_settings_link`, `close_account`, `update_email`).
  - Performs operation (e.g. mark account closed, send unsubscribe) and logs to `actionLogs`.

## Tasks Feature
- Tasks API `/api/tasks`:
  - GET: list tasks owned by current user, ordered by creation time.
  - POST: create or upsert a task with title, type, status, and optional account id and due date.
  - PATCH: update status/title/type/due date with ownership verification.
  - DELETE: delete task after confirming owner.
- Tasks page `/tasks`:
  - Auth-protected via `useRequireAuth`.
  - Task creation form with title and type (review/unsubscribe/close_account/update_email/enable_2fa).
  - Sorting options (by due date, created, or title; asc/desc).
  - Mobile layout: cards grouped by status (Open, In Progress, Done) with status selectors.
  - Desktop layout: table view with same status controls.

## Settings & Privacy
- Settings page `/settings`:
  - Auth-protected using `useRequireAuth`.
  - Export Data:
    - Calls `/api/account/export`.
    - Displays JSON of mailboxes, accounts, and inventory summary.
  - Delete My Data:
    - Calls `/api/account/delete` and shows result via alert.
- Account export API `/api/account/export`:
  - Auth check and user scoping via `userid`.
  - Returns:
    - Mailboxes and accounts for the user.
    - Inventory row count across the user’s mailboxes.
- Account delete API `/api/account/delete`:
  - Auth check and user scoping.
  - Deletes:
    - Messages and inventory per mailbox.
    - Accounts, accountEvidence, tasks, actionLogs, and mailboxes for the user.
- Privacy page `/privacy`:
  - Describes header-only indexing.
  - Lists OAuth scopes used for Gmail and Microsoft.
  - States token encryption with AES-256-GCM and storage in Supabase Postgres.
  - Mentions one-click unsubscribe behavior and the need for a clear privacy policy.

## Diagnostics & Test Utilities
- Supabase diagnostics `/api/diagnostics/supabase`:
  - Verifies authenticated access.
  - Checks read access to all key tables.
  - Tests ability to insert and delete a task row.
  - Returns structured results for tables and RLS behavior.
- Database test endpoint `/api/test-db`:
  - Auth check.
  - Inserts and reads back a test `actionLogs` row.
  - Deletes the test row.
  - Returns test record, the user’s mailboxes, and a success message.

## Miscellaneous
- Global UI components based on shadcn + Radix (buttons, cards, sheets, dialogs, tables, etc.).
- Custom toast system with limited concurrent toasts and long display time.
- Placeholder data and types for emails and domains used in UI components when underlying data is absent.
