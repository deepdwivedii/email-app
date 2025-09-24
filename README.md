# Firebase Studio (Email Subscriptions App)

This is a Next.js app deployed with Firebase that helps you review marketing senders (by root domain), unsubscribe where possible, and manually sync recent emails from Gmail and Outlook.

## What’s included

- OAuth connect for Gmail and Microsoft Outlook
- Manual sync (Dashboard → Sync Now)
  - Scopes sync to the current mailbox via an httpOnly cookie (mb)
  - Gmail: fetches recent metadata only (From/To/Subject/List-Unsubscribe headers)
  - Outlook: fetches recent messages via Microsoft Graph
  - Outlook access token auto-refresh and secure persistence
  - Updates lastSyncAt for the mailbox and returns a summary payload
- Inventory API returns domains with inventoryId and mailboxId
- Unsubscribe API persists inventory status server-side when unsubscribe succeeds
- Dashboard UI toasts summarizing sync results and a “Last synced” indicator

## Quick start

1) Install dependencies
- npm install

2) Run the dev server (port 9002)
- npm run dev
- Open http://localhost:9002/

## Environment variables

Set these in your environment (e.g., .env.local for Next.js and project config for Firebase):
- GMAIL_OAUTH_CLIENT_ID
- GMAIL_OAUTH_CLIENT_SECRET
- MS_OAUTH_CLIENT_ID
- MS_OAUTH_CLIENT_SECRET
- Firebase Admin credentials (per your existing setup)

## OAuth configuration

Add the following authorized redirect URIs to your OAuth apps:
- Google (Gmail):
  - http://localhost:9002/api/oauth/google/callback (local)
  - https://<your-domain>/api/oauth/google/callback (production)
  - Scopes requested: https://www.googleapis.com/auth/gmail.metadata, openid, email
- Microsoft (Outlook/Graph):
  - http://localhost:9002/api/oauth/microsoft/callback (local)
  - https://<your-domain>/api/oauth/microsoft/callback (production)
  - Scopes requested: https://graph.microsoft.com/Mail.Read, offline_access, openid, email, profile

On successful OAuth, the app sets an httpOnly cookie (mb) with the mailbox id for scoping.

## API contracts (summary)

- POST /api/sync
  - Requires: mb cookie (mailbox id set after OAuth callbacks)
  - Response: { gmail: number, outlook: number, errors: string[], lastSynced: number }
  - Side effects: updates mailbox.lastSyncAt; persists refreshed Outlook tokens if needed

- GET /api/inventory
  - Response: { domains: Array<{ domain, count, lastSeen, category, isUnsubscribed?, inventoryId?, mailboxId? }>} (mock items may omit inventoryId)

- POST /api/unsubscribe
  - Body: { listUnsubscribe: string, listUnsubscribePost?: string, inventoryId?: string }
  - Behavior: Performs one-click HTTP unsubscribe if available; otherwise acknowledges mailto. If successful and inventoryId provided, updates inventory status server-side.

## Cookies

- mb: httpOnly cookie set by OAuth callbacks, used by /api/sync to restrict operations to the current mailbox. Secure and sameSite=lax; secure is enabled on https.

## Security notes

- Access and refresh tokens are stored encrypted server-side.
- No secrets are logged.

## Development notes

- Dev server runs on port 9002 (Next.js Turbopack).
- If you support multiple mailboxes later, add a selector to update the mb cookie.
