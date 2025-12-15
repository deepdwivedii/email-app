## Current-State Verification

**Implementation status (Dec 2025):** Most of the v1 data model, sync pipeline, accounts APIs, tasks, unsubscribe flows, and export/delete endpoints are live and wired through Atlas’ UI. Remaining work is primarily around multi-mailbox UX, richer categorization and trust signals, PSL-based domain extraction, a dedicated service registry, deeper observability/metrics, and full-fidelity export of messages and evidence.
- OAuth and session cookies: implemented in `src/app/api/auth/session/route.ts:5` and OAuth callbacks for Gmail `src/app/api/oauth/google/callback/route.ts:19` and Microsoft `src/app/api/oauth/microsoft/callback/route.ts:19`.
- Mailbox model and storage: `src/lib/server/db.ts:1–33` defines `Mailbox`; upsert in `src/lib/server/db.ts:52` with collections `mailboxes/messages/inventory`.
- Sync (manual + scheduled): manual sync in `src/app/api/sync/route.ts:1–170` (Gmail metadata + Outlook Graph). Scheduled syncs in `src/functions/index.ts:1–200` using Gmail History and Outlook Delta cursors.
- Domain inventory (subscriptions): served by `GET /api/inventory` in `src/app/api/inventory/route.ts:17` returning recent emails per root domain; status marking in `src/app/api/inventory/[id]/mark/route.ts:1`.
- Unsubscribe actions: `POST /api/unsubscribe` in `src/app/api/unsubscribe/route.ts:1` supports RFC 8058 One-Click and mailto acknowledgement.
- AI assist (unsubscribe domain suggestion): `POST /api/ai/suggest-domain` `src/app/api/ai/suggest-domain/route.ts:1` calls flow `src/ai/flows/suggest-unsubscribe-domain.ts:1`.
- Accounts-first intelligence: `EmailIdentity`, `Account`, `AccountEvidence`, `Task`, and `ActionLog` types and collections live in `src/lib/server/db.ts:36–120`; classifier in `src/lib/server/classify.ts:1–40`; inference and confidence scoring in `src/lib/server/infer.ts:1–120`; wired into manual and scheduled sync via `src/app/api/sync/route.ts:20–84` and `src/functions/index.ts:20–78`.
- Governance APIs: export and delete endpoints implemented at `src/app/api/account/export/route.ts:1` and `src/app/api/account/delete/route.ts:1`, scoped by session cookie.
- UI: Dashboard (`src/app/dashboard/page.tsx`) lists domain inventory; Accounts (`src/app/accounts/page.tsx`) surfaces inferred accounts with filters and actions; Tasks (`src/app/tasks/page.tsx`) manages follow-up work.

## Gaps vs PRD
- Multi-mailbox UX: `mb` and optional `mb_mode` cookies exist (`/api/mailboxes/active`), but there is no full merged-inbox UI or mailbox manager that exposes merged vs per-mailbox views.
- Categorization and trust: DKIM/Authentication-Results headers are not persisted; category defaults rely on domain heuristics in `infer.ts` and do not yet use a registry of known services or auth results.
- Root domain extraction: `src/lib/server/domain.ts:1–27` uses a lightweight heuristic for registrable domains; no Public Suffix List–backed extraction yet.
- Service registry: `serviceAliases` collection supports simple alias → canonical domain mapping, but there is no `serviceRegistry` module with settings URLs, unsubscribe patterns, or rich metadata.
- Observability and reliability: `fetchWithRetry` in `src/lib/server/fetch.ts:1–18` adds exponential backoff for provider APIs, but there is no metrics collection, job counters, or dedicated `metrics` collection.
- AI augmentation for accounts: unsubscribe-domain suggestion exists, but there is no Genkit flow for naming/categorization/merge suggestions on `Account` records.
- Data export depth: `POST /api/account/export` returns high-level summaries for `mailboxes/accounts/inventory`; full-message and evidence export remains future work for compliance-grade exports.

## v1 Implementation Plan

### Data Model Additions
- Extend `src/lib/server/db.ts` with new types and collection helpers:
  - `EmailIdentity` (per mailbox email) with `email`, `provider`, `mailboxId`, timestamps.
  - `Account` (per service+identity) with `serviceName`, `serviceDomain`, `category`, `confidenceScore`, `explanation`, `firstSeenAt/lastSeenAt`, `status`.
  - `AccountEvidence` linking messages → account with `evidenceType`, `signals`, `excerpt`, `weight`.
  - `Task` with `type`, `status`, optional `dueAt`.
  - `ActionLog` with `actionType`, `executionMode`, `target`, `status`, `error`.
- Add collection functions: `emailIdentitiesCol()`, `accountsCol()`, `accountEvidenceCol()`, `tasksCol()`, `actionLogsCol()`.

### Inbox Connection & Identity
- On OAuth callbacks:
  - Create `EmailIdentity` for connected mailbox email, linked to `Mailbox` (`src/app/api/oauth/google/callback/route.ts:47`, `src/app/api/oauth/microsoft/callback/route.ts:64`).
  - Store `mb` cookie as today; add optional merged view flag cookie `mb_mode=merged`.
- New API `GET /api/mailboxes` to list mailboxes; `POST /api/mailboxes/active` to set active mailbox (if single-view retained). Add `emailIdentities` in response to support filtered view.

### Sync & Ingestion Enhancements
- Keep header-only ingestion; add selective content fetch only when classifier needs it (e.g., for ambiguous `account_created` signals):
  - Gmail: fetch `payload.headers` already used; include `Authentication-Results` and `DKIM-Signature`.
  - Outlook: include `internetMessageHeaders` already; look for `Authentication-Results` equivalent.
- Harden cursors:
  - Gmail History: catch 404 invalid `startHistoryId`; fall back to window search and reset `cursor` (`src/functions/index.ts:95-101` already checks; add reset path and logging).
  - Outlook Delta: persist and rotate `@odata.deltaLink` with invalidation recovery (`src/functions/index.ts:223-256` foundation exists; add error-path reset).
- Rate limiting: add exponential backoff and retry wrappers around provider fetches with jitter; centralize in util.

### Account Discovery Pipeline
- New server module `src/lib/server/classify.ts`:
  - Deterministic rules mapping headers → intent: `account_created`, `email_verification`, `login_alert`, `password_reset`, `billing/receipt`, `subscription/newsletter`, `security_alert`, `marketing`, `unknown`.
  - Extract signals: keywords in `Subject`, sender domain, `List-Unsubscribe`, auth results, `Return-Path`, `X-` headers.
- New server module `src/lib/server/infer.ts`:
  - Aggregator: group evidence by candidate service (domain normalization + service registry mapping).
  - Confidence scoring: weighted sum of evidence types; threshold to create/update `Account`.
  - Explanation: short human-readable string built from top signals.
- Store `AccountEvidence` per message; upsert `Account` with `firstSeenAt/lastSeenAt`, `status` default `unknown`.
- AI augmentation flow (advisory only): for naming/category/merge suggestions when deterministic confidence below threshold; reuse Genkit with new prompt(s). Store as advisory notes on `Account` (without overwriting truth).

### Actions & Task Manager
- Actions framework module `src/lib/server/actions.ts`:
  - Declare actions with execution modes: `link`, `mailto`, `manual`, `api`.
  - Implement `unsubscribe` using existing endpoint; wrap execution in audit logger.
  - Add `POST /api/accounts/:id/actions` to execute and emit `ActionLog`.
- Tasks APIs `GET/POST /api/tasks` for CRUD and status transitions; tasks linked to accounts where applicable.
- Audit logging API `GET /api/action-log` filtered by user/account/mailbox.

### UI/UX
- Primary nav: Accounts / Tasks / Mailboxes / Subscriptions (secondary) / Settings.
- Accounts Dashboard: list by `category`, filter by `emailIdentity`, show `confidence`, `lastSeen`, suggested actions.
- Account Detail: evidence timeline, explanation, actions, tasks.
- Mailbox Manager: list and switch mailboxes; toggle merged vs filtered view; show identities.
- Retain Domain Inventory as secondary view in Dashboard.

### Categorization & Trust Signals
- DKIM and Authentication-Results extraction in sync:
  - Gmail: include headers and parse `dkim=pass`, `spf=pass`.
  - Outlook: parse equivalent headers.
- Deterministic category rules:
  - Bank: keywords, known domains in registry.
  - Social/Ecommerce/SaaS/Subscription: match against registry and subject templates.
- Add best-effort security-alert detection: look for phrases like "unusual sign-in", "password reset", etc.; raise `risk` counters.

### Root Domain Extraction (PSL)
- Replace heuristic in sync with PSL-backed registrable domain extraction via `publicsuffix` library (server-side). Encapsulate in `src/lib/server/domain.ts` and use in both manual and scheduled syncs.

### Service Registry
- Introduce `src/lib/server/serviceRegistry.ts`:
  - Known service domains → canonical service name, category defaults.
  - Account settings deep-link templates.
  - Known unsubscribe patterns.
- Used by classifier/infer and UI to unify related domains into one service.

### Observability & Reliability
- Centralized fetch util with retries/backoff and structured logs.
- Job metrics: count processed messages, new accounts inferred, failures; expose via logs and optional lightweight `metrics` collection.
- Error reporting hooks around sync and actions.

### Security & Privacy
- Access control: ensure server-only access for sensitive collections; validate `__session` on all new APIs.
- Data minimization: only headers by default; gate full-body fetch behind explicit flags and log audit.
- Export/delete APIs: `POST /api/account/export`, `POST /api/account/delete` to produce user-scoped exports and delete data.

### API Surface (v1)
- `GET /api/mailboxes`, `POST /api/mailboxes/active`.
- `POST /api/sync/all` (manual sync across mailboxes) in addition to existing `POST /api/sync`.
- `GET /api/accounts?emailIdentityId=&category=&status=&minConfidence=`.
- `GET /api/accounts/:id`.
- `POST /api/accounts/:id/actions`.
- `GET/POST /api/tasks`.
- `GET /api/action-log`.

### Migration & Backfill Strategy
- Derive `EmailIdentity` for existing `mailboxes` on first run.
- Backfill `Account` and `AccountEvidence` from existing `messages` with batch classifier/infer job.
- Maintain idempotency: evidence upserts keyed by `messageId`, accounts keyed by `serviceDomain+emailIdentityId`.

### README & Documentation
- Update `/README.md` sections: Architecture, Data Model additions, API Endpoints, Security, Deployment, Troubleshooting.
- Reflect new dashboards and flows; de-emphasize domain inventory as secondary.

### Verification
- Unit tests for classifier and domain extraction.
- Manual validation via dev server for multi-mailbox switch, accounts list/detail, actions/audit.
- Review logs for sync and inference correctness.

## Work Sequencing
1) Add data models and collections; update OAuth to create `EmailIdentity`.
2) Build classifier/infer pipeline and wire into sync (manual/scheduled) to populate `accounts` and `accountEvidence`.
3) Implement Accounts APIs and UI (list/detail with evidence).
4) Add actions framework, tasks, audit log; wire unsubscribe into audit logging.
5) Replace root-domain heuristic with PSL extraction; introduce service registry; add category rules.
6) Add multi-mailbox manager and merged view.
7) Harden sync: rate limits, cursor recovery, logs/metrics.
8) Add export/delete APIs and settings UI.

## Notes
- Preserve existing cookies and flows; avoid breaking current dashboard.
- AI remains advisory; only used when deterministic rules are uncertain.
- Keep headers-only ingestion by default; selective content fetch gated.
