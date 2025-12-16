import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js/dist/module/index.js';

export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string);

  const client = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  try {
    const store = await cookies();
    const all = store.getAll();
    const authCookie = all.find(c => c.name.includes('-auth-token'));
    if (authCookie?.value) {
      try {
        const parsed = JSON.parse(authCookie.value);
        const access_token =
          parsed?.access_token ??
          parsed?.data?.access_token ??
          parsed?.accessToken;
        const refresh_token =
          parsed?.refresh_token ??
          parsed?.data?.refresh_token ??
          parsed?.refreshToken;
        if (access_token && refresh_token) {
          await client.auth.setSession({ access_token, refresh_token });
        }
      } catch {}
    }
  } catch {}
  return client;
}
