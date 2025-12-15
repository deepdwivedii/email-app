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

- Production: configure the same values in Firebase environment.

The app reads them in:

- `src/app/api/oauth/microsoft/start/route.ts:7–8`
- `src/app/api/oauth/microsoft/callback/route.ts:28–29`
- `src/app/api/sync/route.ts:168–169`
- `src/functions/index.ts:191–192`

---

## 3. Firebase – Client and Admin

You already have Firebase client config in `src/lib/firebase.ts:1–12`, and the Admin SDK setup in `src/lib/server/firebase-admin.ts:1–12`.

You mainly need to:

- Confirm the Firebase project.
- Ensure Auth + Firestore are enabled.
- Decide how Admin credentials are provided (prod vs local).

### 3.1 Confirm / create Firebase project

1. Go to https://console.firebase.google.com/.
2. Create or select the project (it should match the IDs in `src/lib/firebase.ts`).
3. Enable:
   - **Authentication** (Email/Password, Google Sign-In, etc. as you like).
   - **Firestore** (in native mode).
   - Optionally, **App Hosting** or **Hosting**.

### 3.2 Web app (client) configuration

You already have a Firebase web app config hard-coded in `src/lib/firebase.ts:4–12`. If you want to regenerate it:

1. In Firebase console → your project → **Settings → General**.
2. Under **Your apps** → **Web app**.
3. Create an app or click an existing one to see:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
   - `storageBucket`
   - `messagingSenderId`
4. Make sure these values match what is in `src/lib/firebase.ts`.

This config is used for frontend auth; it is not secret (though `apiKey` should not be treated as a password).

### 3.3 Admin SDK (server side)

Admin initialization is here:

- `src/lib/server/firebase-admin.ts:1–12`

The code prefers Google’s **Application Default Credentials** (ADC). On Firebase Hosting / App Hosting, this uses the built‑in service account automatically, so you don’t need a JSON key file in production.

For **local development**, you have 2 options:

1. **Use a service account file** (recommended when doing server-side admin work locally):
   - In Firebase console:
     - Go to **Project Settings → Service accounts**.
     - Click **Generate new private key** for the Firebase Admin SDK.
    - Store the downloaded JSON file outside of git (e.g. `~/secrets/atlas-firebase-admin.json`).
   - Set an environment variable locally (NOT committed to `.env.local` in git, but you can export it in your shell or `.bashrc`):

     ```bash
    set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\atlas-firebase-admin.json
     ```

   - The Admin SDK will pick it up via `applicationDefault()`.

2. **Rely on GCP/Firebase environment**:
   - Don’t set `GOOGLE_APPLICATION_CREDENTIALS` at all.
   - When deployed to Firebase Hosting/App Hosting, the platform injects credentials.

In this repo, we’ve intentionally **removed** the broken local pointer `GOOGLE_APPLICATION_CREDENTIALS=./credentials/firebase-service-account-key.json` from `.env.local` so builds don’t fail if that file doesn’t exist.

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

---

## 6. Local `.env.local` Template

Here is a single template you can fill in:

```bash
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

# Optional: local Admin SDK via ADC (set in shell, not committed)
# GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\atlas-firebase-admin.json
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
- [ ] `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` stored in your secret manager and configured in Firebase.
- [ ] Microsoft Entra app registration with:
  - [ ] Redirect URIs for localhost and production.
  - [ ] Delegated permissions: `Mail.Read`, `offline_access`, `openid`, `email`, `profile`.
  - [ ] Admin consent granted.
  - [ ] `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET` stored and configured.
- [ ] Firebase project with Auth + Firestore enabled and the web client config matching `src/lib/firebase.ts`.
- [ ] `ENCRYPTION_KEY_32B` set identically across local and prod.
- [ ] Optional: `GEMINI_API_KEY` set.
- [ ] `npm run build` succeeds locally.
- [ ] `firebase deploy` to Hosting / App Hosting completes.

If you tell me which cloud accounts you’re using (Google workspace vs personal, Azure vs M365, etc.), I can narrow this down further and tailor the steps for exactly your setup.
