# Atlas — Your digital accounts, carried in one place.

## Purpose

- Manage email subscriptions by indexing headers from Gmail and Outlook, aggregating senders by root domain, and enabling safe unsubscribe actions with AI assistance.

## Capabilities

- OAuth connect for Gmail and Outlook with encrypted token storage.
- Manual sync from the Dashboard and scheduled background sync jobs.
- Header-only ingestion: From, To, Subject, Date, List-Unsubscribe, List-Unsubscribe-Post.
- Domain inventory with counts, last seen, unsubscribe status, and recent emails.
- Safe Unsubscribe: RFC 8058 one-click HTTP when available; `mailto:` acknowledged.
- AI Suggestion: Gemini via Genkit recommends the most likely unsubscribe domain with confidence and reasoning.
- Accounts-first UI backed by evidence; Tasks page to track actions.
- Settings page for privacy controls (export/delete) and a footer link for discoverability.

## Architecture

- Next.js 15 (App Router) with React 18 and TypeScript.
- Firebase Admin for server operations; Firestore for storage.
- API routes under `src/app/api` for auth/session, OAuth, inventory, sync, unsubscribe, AI, accounts, tasks, action-log, mailboxes, privacy controls.
- Scheduled Cloud Functions for periodic sync of Gmail History and Outlook Delta.
- OneSignal service worker stubs exist under `public/` to prevent dev 404s; no push behavior is implemented by default.

### Directory Overview

```
src/
├── ai/                         # Genkit config and flows
├── app/                        # App Router + API endpoints
├── components/                 # UI components and dialogs
├── functions/                  # Firebase Functions (scheduled sync)
├── hooks/                      # Auth and utilities
├── lib/                        # Server/client libs (crypto, db, firebase)
└── types/                      # Shared types
```

### Data Model (Firestore)

```
mailboxes: {
  id, userId, provider, email, tokenBlobEncrypted, cursor?, connectedAt, lastSyncAt?
}
messages: {
  id, mailboxId, providerMsgId, from?, to?, subject?, receivedAt,
  listUnsubscribe?, listUnsubscribePost?, rootDomain?
}
inventory: {
  id, mailboxId, rootDomain, firstSeen, lastSeen, msgCount,
  hasUnsub, status ('active'|'moved|'ignored'), changeEmailUrl?
}
emailIdentities: {
  id, userId, email, provider, mailboxId, verifiedAt?, createdAt
}
accounts: {
  id, userId, emailIdentityId, serviceName, serviceDomain,
  category ('bank'|'social'|'ecommerce'|'saas'|'subscription'|'other'),
  confidenceScore, explanation, firstSeenAt, lastSeenAt, status
}
accountEvidence: {
  id, userId, accountId, mailboxId, messageId, evidenceType,
  excerpt?, signals, weight, createdAt
}
tasks: {
  id, userId, accountId?, title, type, status, dueAt?, createdAt
}
actionLogs: {
  id, userId, accountId?, mailboxId?, actionType, executionMode, target?,
  status, error?, createdAt
}
```

## Key Flows

- Login and session cookie
  - Client signs in via Firebase Auth; server sets `__session` cookie.
- OAuth Connect (Gmail/Outlook)
  - Start → Consent → Callback → Token exchange → Encrypted storage → Set `mb` cookie.
- Sync (manual and scheduled)
  - Gmail: recent metadata and History API; Outlook: Graph with delta and token refresh.
  - Upserts `messages` and `inventory`; classifies intents and records `accountEvidence`; infers/updates `accounts`; updates mailbox `lastSyncAt` and cursors.
- Inventory and actions
  - Accounts-first UI lists services with confidence and evidence; Domain inventory retained as secondary view. Unsubscribe triggers one‑click URL or mailto acknowledgement and writes `actionLogs`.
- AI Suggestion
  - Dialog calls `/api/ai/suggest-domain`; flow returns domain, confidence, and reason.
- Privacy Controls
  - Settings page provides export and delete actions backed by server APIs.
- Merged View (experimental)
  - Setting active mailbox supports an optional merged mode via `mb_mode` cookie.

## API Endpoints

- `POST /api/auth/session` — Set/clear session cookie from Firebase ID token.
- `GET /api/oauth/google/start` / `GET /api/oauth/google/callback`
- `GET /api/oauth/microsoft/start` / `GET /api/oauth/microsoft/callback`
- `GET /api/inventory` — Domains for current user with recent emails.
- `POST /api/sync` — Manual sync for current mailbox (scoped by `mb` cookie).
- `POST /api/unsubscribe` — One‑click unsubscribe or `mailto:` acknowledgement.
- `POST /api/ai/suggest-domain` — AI suggestion for unsubscribe domain.
- `POST /api/inventory/[id]/mark` — Update domain status (`active|moved|ignored`).
- `GET /api/mailboxes` — List connected mailboxes and email identities.
- `POST /api/mailboxes/active` — Set active mailbox; optional `mode=merged`.
- `POST /api/mailboxes/:id/disconnect` — Disconnect mailbox and delete scoped data.
- `GET /api/accounts` — List accounts with filters (`emailIdentityId`, `category`, `status`, `minConfidence`).
- `GET /api/accounts/:id` — Account detail with evidence.
- `GET /api/accounts/:id/unsubscribe` — Retrieve unsubscribe info for an account.
- `POST /api/accounts/:id/actions` — Execute actions (unsubscribe/link/manual tracking).
- `GET/POST /api/tasks` — Manage tasks.
- `GET /api/action-log` — Retrieve audit logs.
- `POST /api/account/export` — Export user-scoped data summary.
- `POST /api/account/delete` — Delete user data (headers-first; limited batch size).

## Setup

- Install: `npm install`
- Dev server: `npm run dev` → `http://localhost:9002`
- AI dev (optional): `npm run genkit:dev` or `npm run genkit:watch`
- Build: `npm run build`; Start: `npm run start`
- QA: `npm run lint` and `npm run typecheck`

## Environment

- `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`
- `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS` (local Admin SDK)
- `ENCRYPTION_KEY_32B` (AES‑256‑GCM key for token encryption)
- Optional: `GEMINI_API_KEY`

## OAuth Configuration

- Gmail:
  - Redirect URIs: `http://localhost:9002/api/oauth/google/callback`, `https://<domain>/api/oauth/google/callback`
  - Scopes: `https://www.googleapis.com/auth/gmail.metadata`, `openid`, `email`
- Microsoft:
  - Redirect URIs: `http://localhost:9002/api/oauth/microsoft/callback`, `https://<domain>/api/oauth/microsoft/callback`
  - Scopes: `https://graph.microsoft.com/Mail.Read`, `offline_access`, `openid`, `email`, `profile`

## Security

- Tokens encrypted with AES‑256‑GCM and stored in Firestore.
- Cookies (`__session`, `mb`) are httpOnly, sameSite=lax, secure on HTTPS.
- Secrets are never logged.
- Data minimization: store headers by default; selective content only when classification requires it.
- Server-side access controls enforced on sensitive collections and APIs.

## Deployment

- Firebase Hosting with frameworks backend (`firebase.json`), region `us-central1`.
- Scheduled Functions in `src/functions/index.ts` for Gmail History and Outlook Delta.
- Ensure production env vars and OAuth apps are configured and verified.
- Observability: structured logs; sync uses retry/backoff for rate limits; cursors recovered on invalidation.

## Troubleshooting

- OAuth failures: verify client IDs, secrets, redirect URIs, and scopes.
- Sync errors: confirm API permissions; check token refresh for Outlook.
- Inventory empty: ensure `__session` and `mb` cookies are set after OAuth.
- AI suggestion errors: verify Genkit config and API key.
- Accounts empty: trigger manual sync; verify `emailIdentities` created on OAuth.
- Repeated 404 for `OneSignalSDKWorker.js`: worker stubs are present under `public/` to prevent dev 404s; integrate OneSignal if push is needed.
