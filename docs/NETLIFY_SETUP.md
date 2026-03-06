# Netlify and Supabase Setup Guide

## Netlify Configuration

1.  **Build Settings**:
    *   Build command: `npm run build`
    *   Publish directory: `.next` (or leave default if using the Next.js plugin)

2.  **Environment Variables**:
    You must set the following environment variables in your Netlify Site Settings (Site configuration > Environment variables):

    *   `SUPABASE_URL`: Your Supabase Project URL.
    *   `SUPABASE_ANON_KEY`: Your Supabase Anon Key.
    *   `SUPABASE_SERVICE_ROLE_KEY`: **Required for background sync**. This key is used by the background function to process emails for all users. It is never exposed to the client.
    *   `ADMIN_APP_TOKEN`: **Required for admin access**. A secret string of your choice used to access `/admin/*` pages and admin APIs.

    > **Important**: Do not use `NEXT_PUBLIC_*` for Supabase on Netlify. Next.js will embed those values into client bundles, and Netlify can block deploys as “exposed secrets”. This app fetches the Supabase URL/key from a server route at runtime, so only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are needed.

## Background Sync Configuration

To enable the 15-minute background sync process:

1.  **Deploy**: Deploy the latest changes to Netlify.
2.  **Verify**: Netlify should automatically detect `netlify/functions/sync-background.ts` and deploy it as a Background Function.
3.  **Trigger**: You need to trigger this function periodically (e.g., every 10-15 minutes).
    *   **Endpoint**: `https://<your-app>.netlify.app/api/jobs/sync-background`
    *   **Method**: `POST` (or GET)
    *   **Tool**: Use a cron service like GitHub Actions, cron-job.org, or Netlify Scheduled Functions (if available on your plan) to hit this URL.

    Example Cron (every 15 mins):
    ```bash
    curl -X POST https://your-app.netlify.app/api/jobs/sync-background
    ```

## Supabase Configuration

1.  **Authentication > URL Configuration**:
    *   **Site URL**: Set this to your production URL (e.g., `https://your-app.netlify.app`).
    *   **Redirect URLs**: Add the following:
        *   `http://localhost:3000/**` (for local development)
        *   `https://your-app.netlify.app/**` (for production)
        *   `https://<preview-id>--your-app.netlify.app/**` (for Netlify Previews, you might need to add them manually or use a wildcard if supported/allowed).

    > Important: Ensure that `https://your-app.netlify.app/auth/callback` is covered by these patterns.

2.  **Authentication > Providers**:
    *   Enable the providers you are using (Google, GitHub, Azure).
    *   Configure the Client ID and Secret for each.
    *   For Google/Microsoft, ensure the **Authorized redirect URIs** in their consoles include:
        *   `https://<your-project-ref>.supabase.co/auth/v1/callback`

## Local Development

*   Run `npm run dev` to start the local server.
*   Ensure `.env.local` contains `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
