# Auth Setup Guide for Atlas / Unified Inbox
_Updated March 2026_

This app needs four main "auth-ish" pieces:

- Google OAuth (Gmail)
- Microsoft OAuth (Outlook / Microsoft 365)
- Supabase (authentication + Postgres database)
- Encryption + AI keys

The sections below walk you through getting each one and wiring it into this repo.

---

## 1. Google OAuth – Gmail

You need a **Web application** OAuth client that can call the Gmail API with `gmail.metadata`, `openid`, and `email`.

### 1.1 Create / select a Google Cloud project

1. Go to the Google Cloud Console: https://console.cloud.google.com
2. Top bar → Project selector → create or choose a project just for this app.
3. Make sure **IAM & Admin → Quotas** and **APIs & Services** are visible.

### 1.2 Enable Gmail API

1. In the left nav: **APIs & Services → Library**.
2. Search for **Gmail API**.
3. Click it → **Enable**.

### 1.3 Configure OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. User type: **External**.
3. App details:
   - App name: `Atlas`.
   - User support email: your email.
   - Authorized domains: `localhost`, `yourdomain.com`.
4. Scopes:
   - `https://www.googleapis.com/auth/gmail.metadata`
   - `openid`
   - `email`
5. Test users: Add your testing Gmail accounts.

### 1.4 Create OAuth client (Web application)

1. Go to: **Google Auth Platform → Clients**.
2. Click **Create client**.
3. Type: **Web application**.
4. Authorized JavaScript origins:
   - `http://localhost:9002`
   - `https://yourdomain.com`
5. Authorized redirect URIs:
   - `http://localhost:9002/api/oauth/google/callback`
   - `https://yourdomain.com/api/oauth/google/callback`
6. Click **Create** and **save the Client Secret immediately**.

You will get:
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`

---

## 2. Microsoft OAuth – Outlook / Microsoft 365

You need a Microsoft Entra ID app registration that can call **Microsoft Graph** with `Mail.Read` and offline access.

### 2.1 Register an app

1. Go to https://entra.microsoft.com/ -> **App registrations**.
2. Click **New registration**.
3. Redirect URI (Web): `http://localhost:9002/api/oauth/microsoft/callback`
4. Click **Register**.
5. Note the **Application (client) ID** (`MS_OAUTH_CLIENT_ID`).

### 2.2 Add client secret

1. Go to **Certificates & secrets** -> **New client secret**.
2. Copy the **Value** (`MS_OAUTH_CLIENT_SECRET`).

### 2.3 Configure API permissions

1. Go to **API permissions** -> **Add a permission** -> **Microsoft Graph**.
2. Delegated permissions:
   - `Mail.Read`
   - `offline_access`
   - `openid`
   - `email`
   - `profile`
3. Click **Grant admin consent**.

---

## 3. Supabase – Auth and Database

### 3.1 Create Supabase project

1. Go to https://supabase.com/dashboard.
2. Create a new project.
3. Note:
   - `Project URL`
   - `anon key`
   - `service_role key` (Required for background sync)

### 3.2 Database schema

Run the migrations or create tables corresponding to:
`mailboxes`, `messages`, `inventory`, `emailIdentities`, `accounts`, `accountEvidence`, `tasks`, `actionLogs`, `serviceAliases`, `sync_runs`, `mailbox_cursors`.

---

## 4. Encryption & AI Keys

### 4.1 Encryption Key (`ENCRYPTION_KEY_32B`)

Generate a random 32-byte hex string:
```bash
openssl rand -hex 32
```

### 4.2 OpenRouter API Key (`OPENROUTER_API_KEY`)

Get a key from https://openrouter.ai/ for AI features.

### 4.3 Admin Token (`ADMIN_APP_TOKEN`)

Generate a random string to protect the Admin UI (`/admin/sync`).

---

## 5. Local `.env.local` Template

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # Required for background sync

# AI
OPENROUTER_API_KEY=...

# Encryption
ENCRYPTION_KEY_32B=...

# Google OAuth (Gmail)
GMAIL_OAUTH_CLIENT_ID=...
GMAIL_OAUTH_CLIENT_SECRET=...

# Microsoft OAuth (Outlook)
MS_OAUTH_CLIENT_ID=...
MS_OAUTH_CLIENT_SECRET=...

# Admin Access
ADMIN_APP_TOKEN=...
```

---

## 6. Production Checklist

- [ ] Google OAuth Client configured with prod URLs.
- [ ] Microsoft App Registration configured with prod URLs.
- [ ] Environment variables set in Netlify (including `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_APP_TOKEN`).
- [ ] `ENCRYPTION_KEY_32B` matches local (or is consistent).
- [ ] Background Sync Cron set up (hitting `/api/jobs/sync-background`).
