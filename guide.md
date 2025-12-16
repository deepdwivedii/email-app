# Auth Setup Guide for Atlas / Unified Inbox  
_As of 12 Dec 2025_

This app needs four main “auth-ish” pieces:

- Google OAuth (Gmail)
- Microsoft OAuth (Outlook / Microsoft 365)
- Firebase (client + Admin)
- Encryption + AI keys

The sections below walk you through getting each one and wiring it into this repo.

---

## 1. Google OAuth – Gmail

You need a **Web application** OAuth client that can call the Gmail API with `gmail.metadata`, `openid`, and `email`.

### 1.1 Create / select a Google Cloud project

1. Go to the Google Cloud Console:  
   https://console.cloud.google.com
2. Top bar → Project selector → create or choose a project just for this app.
3. Make sure **IAM & Admin → Quotas** and **APIs & Services** are visible (you have owner/editor on the project).

### 1.2 Enable Gmail API

1. In the left nav: **APIs & Services → Library**.
2. Search for **Gmail API**.
3. Click it → **Enable**.

### 1.3 Configure OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. User type:
   - For personal testing: **External**.
   - For a company deployment: typically **External**, then add the domains you’ll use.
3. App details:
-   - App name: something like `Atlas`.
   - User support email: your email.
   - App domain: your production domain (e.g. `yourdomain.com`) once you know it.
   - Authorized domains: add both:
     - `localhost`
     - `yourdomain.com` (replace with real domain).
4. Scopes:
   - Add at least:
     - `https://www.googleapis.com/auth/gmail.metadata`
     - `openid`
     - `email`
5. Test users:
   - While the app is in “Testing”, add the Gmail accounts you’ll use for QA.
6. Save and continue until complete.

### 1.4 Create OAuth client (Web application)

As of 2025, Google moved OAuth client management into **Auth Platform → Clients** [Google docs, last updated 2025-08-05 and 2025-06 updates for client secrets visibility](https://support.google.com/cloud/answer/15549257).  

1. Go to: **Google Auth Platform → Clients** (or **APIs & Services → Credentials → OAuth 2.0 Client IDs**, which now redirects).
2. Click **Create client**.
3. Type: **Web application**.
4. Name: `atlas-web` (any name).
5. Authorized JavaScript origins:
   - `http://localhost:9002`
   - `https://yourdomain.com` (prod)
6. Authorized redirect URIs:
   - `http://localhost:9002/api/oauth/google/callback`
   - `https://yourdomain.com/api/oauth/google/callback`
7. Click **Create**.

> Important (2025 change): The **client secret is only shown once when you create the client**. Store it immediately in a password manager or secret manager [Google “Manage OAuth Clients”](https://support.google.com/cloud/answer/15549257).

You will get:

- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`

### 1.5 Wire into this repo

Set these values:

- Local (in `.env.local`):

```bash
GMAIL_OAUTH_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GMAIL_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
```

- Production (Firebase Hosting / App Hosting):
  - Use `firebase deploy` env configuration (either via Firebase CLI or the Hosting/App Hosting console) to set:

```bash
GMAIL_OAUTH_CLIENT_ID=...
GMAIL_OAUTH_CLIENT_SECRET=...
```

The app reads them in:

- `src/app/api/oauth/google/start/route.ts:13–14`
- `src/app/api/oauth/google/callback/route.ts:28–29`
- `src/app/api/sync/route.ts:110–111`
- `src/functions/index.ts:84–85`

---

## 2. Microsoft OAuth – Outlook / Microsoft 365

You need a Microsoft Entra ID app registration that can call **Microsoft Graph** with `Mail.Read` and offline access.

### 2.1 Open Microsoft Entra admin center

1. Go to https://entra.microsoft.com/ (formerly Azure AD).
2. Ensure you are in the correct tenant (top-right “Settings” → tenant selector).

### 2.2 Register an app

1. Left nav: **Microsoft Entra ID → App registrations**.
2. Click **New registration** [Microsoft Learn “Register an app in Microsoft Entra ID”](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
3. Name: `Atlas Outlook`.
4. Supported account types:
   - For your own organization only: **Accounts in this organizational directory only**.
   - If you want to support personal accounts too, choose the broader option.
5. Redirect URI:
   - Type: **Web**
   - URL: `http://localhost:9002/api/oauth/microsoft/callback`
6. Click **Register**.

On the Overview page, note:

- `Application (client) ID` → this is `MS_OAUTH_CLIENT_ID`.
- `Directory (tenant) ID` (you don’t need it directly in this repo, but keep it handy).

### 2.3 Add client secret

1. In the app, go to **Certificates & secrets**.
2. Under **Client secrets**, click **New client secret** [Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal).
3. Description: `atlas-outlook`.
4. Expiry: 6–12 months is typical; pick what fits your security policy.
5. Click **Add**.
6. Copy the **Value** column immediately – that is your `MS_OAUTH_CLIENT_SECRET`. (The “Secret ID” is not used in auth [good explanation: Ryan Spletzer blog, 2025](https://www.spletzer.com/2025/01/how-to-get-your-client-id-and-client-secret-from-entra-id/).)

### 2.4 Configure API permissions

1. In the app, go to **API permissions**.
2. Click **Add a permission → Microsoft Graph**.
3. Use **Delegated permissions**:
   - Add:
     - `Mail.Read`
     - `offline_access`
     - `openid`
     - `email`
     - `profile`
4. Click **Add permissions**.
5. Click **Grant admin consent for <tenant>** and confirm.

### 2.5 Add production redirect URI

When you know your production domain:

1. Go to **Authentication** tab.
2. Under **Redirect URIs**, add:
   - `https://yourdomain.com/api/oauth/microsoft/callback`.
3. Save.

### 2.6 Wire into this repo

Set env vars:

- Local `.env.local`:

```bash
MS_OAUTH_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MS_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

- Production: configure the same values in your hosting environment.

The app reads them in:

- `src/app/api/oauth/microsoft/start/route.ts:7–8`
- `src/app/api/oauth/microsoft/callback/route.ts:28–29`
- `src/app/api/sync/route.ts:168–169`

---

## 3. Supabase – Auth and Database

This app now uses Supabase for authentication and data storage.

You mainly need to:

- Create a Supabase project.
- Configure Auth (Email/Password enabled).
- Provision the Postgres tables used by the app.

### 3.1 Create Supabase project

1. Go to https://supabase.com/ → sign in.
2. Create a new project and note:
   - `Project URL`
   - `anon key`
   - Optional: `service role key` (not required with auth-helpers cookie-based sessions).

### 3.2 Web app (client) configuration

Set the following in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The client is initialized in `src/lib/supabase-client.ts`, and sessions are managed using `@supabase/auth-helpers-nextjs` via cookies on route handlers.

### 3.3 Database schema (Postgres)

Create tables corresponding to previous Firestore collections:

- `mailboxes` (`id` text primary key, `userId` text, `provider` text, `email` text, `tokenBlobEncrypted` text, `cursor` text, `connectedAt` bigint, `lastSyncAt` bigint)
- `messages` (`id` text primary key, `mailboxId` text, `providerMsgId` text, `from` text, `to` text, `subject` text, `receivedAt` bigint, `listUnsubscribe` text, `listUnsubscribePost` text, `dkimDomain` text, `rootDomain` text, `category` text)
- `inventory` (`id` text primary key, `mailboxId` text, `rootDomain` text, `displayName` text, `firstSeen` bigint, `lastSeen` bigint, `msgCount` int, `hasUnsub` boolean, `changeEmailUrl` text, `status` text)
- `emailIdentities` (`id` text primary key, `userId` text, `email` text, `provider` text, `mailboxId` text, `verifiedAt` bigint, `createdAt` bigint)
- `accounts` (`id` text primary key, `userId` text, `emailIdentityId` text, `serviceName` text, `serviceDomain` text, `category` text, `confidenceScore` float, `explanation` text, `firstSeenAt` bigint, `lastSeenAt` bigint, `status` text)
- `accountEvidence` (`id` text primary key, `userId` text, `accountId` text, `mailboxId` text, `messageId` text, `evidenceType` text, `excerpt` text, `signals` jsonb, `weight` float, `createdAt` bigint)
- `tasks` (`id` text primary key, `userId` text, `accountId` text, `title` text, `type` text, `status` text, `dueAt` bigint, `createdAt` bigint)
- `actionLogs` (`id` text primary key, `userId` text, `accountId` text, `mailboxId` text, `actionType` text, `executionMode` text, `target` text, `status` text, `error` text, `createdAt` bigint)
- `serviceAliases` (`id` text primary key, ...optional fields as needed)

Add row-level security (RLS) to scope data to `userId`, and policies to allow the authenticated user to read/write their own records.

---

## 4. Encryption Key (`ENCRYPTION_KEY_32B`)

The app encrypts OAuth tokens for storage using AES‑256‑GCM:

- `src/lib/server/crypto.ts:4` expects `ENCRYPTION_KEY_32B`.

### 4.1 Generate a key (example workflow)

You need a 32‑byte (256‑bit) key. Do **not** use a human password. Generate a random hex string and keep it secret.

Examples:

- Using Node REPL:

  ```js
  require('crypto').randomBytes(32).toString('hex');
  ```

- Using OpenSSL (in a shell):

  ```bash
  openssl rand -hex 32
  ```

Take the resulting 64-character hex string and set:

```bash
ENCRYPTION_KEY_32B=<that-hex-string>
```

### 4.2 Configure locally and in prod

- Local `.env.local`:

```bash
ENCRYPTION_KEY_32B=9e6d1c9e8d7c8b6a3d1f9a8d7c8b6a3d  # example, replace
```

- Production: set the same key in your Firebase environment.
  - This key must not change between deployments; changing it would break decryption of existing token blobs.

---

## 5. AI / Gemini (`GEMINI_API_KEY`)

The AI suggestion flow uses Genkit with Gemini (`src/ai/flows/suggest-unsubscribe-domain.ts` and `src/ai/genkit.ts`).

### 5.1 Get a Gemini API key

1. Go to https://aistudio.google.com/ or the Gemini section of Google Cloud.
2. Create / select a project, enable the **Gemini API** or **Generative Language** API.
3. Generate an API key from the console.

### 5.2 Configure in this repo

- Local `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_key_here
```

- Production: set in Firebase environment as `GEMINI_API_KEY`.
- Production: set in your hosting environment as `GEMINI_API_KEY`.

---

## 6. Local `.env.local` Template

Here is a single template you can fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# AI
GEMINI_API_KEY=...

# Encryption
ENCRYPTION_KEY_32B=...   # 32-byte key as hex

# Google OAuth (Gmail)
GMAIL_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GMAIL_OAUTH_CLIENT_SECRET=...

# Microsoft OAuth (Outlook)
MS_OAUTH_CLIENT_ID=...
MS_OAUTH_CLIENT_SECRET=...

# No Firebase credentials required
```

Then:

```bash
npm run build
npm run start
```

---

## 7. Production Checklist

When you’re ready to deploy for real:

- [ ] Google project created; Gmail API enabled; web OAuth client with localhost + production redirect URIs.
- [ ] `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` stored in your secret manager and configured in your hosting environment.
- [ ] Microsoft Entra app registration with:
  - [ ] Redirect URIs for localhost and production.
  - [ ] Delegated permissions: `Mail.Read`, `offline_access`, `openid`, `email`, `profile`.
  - [ ] Admin consent granted.
  - [ ] `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET` stored and configured.
- [ ] Supabase project created; `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured.
- [ ] Supabase Postgres tables created with RLS enforcing per-user access.
- [ ] `ENCRYPTION_KEY_32B` set identically across local and prod.
- [ ] Optional: `GEMINI_API_KEY` set.
- [ ] `npm run build` succeeds locally.
- [ ] Deploy to your chosen hosting platform.

If you tell me which cloud accounts you’re using (Google workspace vs personal, Azure vs M365, etc.), I can narrow this down further and tailor the steps for exactly your setup.

---

## Updates (Dec 2025)
- OneSignal: Worker stubs are present under `public/OneSignalSDKWorker.js` and `public/OneSignalSDKUpdaterWorker.js` to prevent dev 404s. No push logic is enabled by default; integrate OneSignal if you need notifications.
- Navigation: Main nav includes `Dashboard`, `Accounts`, `Mailboxes`, `Tasks`, `Settings` (`src/components/main-nav.tsx`). Footer includes `Privacy` and `Settings` links (`src/app/page.tsx`).
- Endpoints: In addition to previously listed APIs, the codebase includes:
  - `POST /api/mailboxes/:id/disconnect` — disconnect mailbox and delete scoped data.
  - `GET /api/accounts/:id/unsubscribe` — fetch unsubscribe info used by Accounts page actions.
