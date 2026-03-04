# Netlify and Supabase Setup Guide

## Netlify Configuration

1.  **Build Settings**:
    *   Build command: `npm run build`
    *   Publish directory: `.next` (or leave default if using the Next.js plugin)

2.  **Environment Variables**:
    You must set the following environment variables in your Netlify Site Settings (Site configuration > Environment variables):

    *   `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.

    > **Important**: Ensure these values are entered correctly and NOT as placeholders (like `********************`) or masked values. If you see asterisks in the value field, re-enter the actual URL and Key. The app has fallback logic to handle accidental placeholders, but it's best to set them correctly.

    > Note: Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` in Netlify unless you are using it in Edge Functions only, and even then be careful. The client-side app only needs the URL and Anon Key.

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
*   Ensure `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
