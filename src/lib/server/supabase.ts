import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string);

  const cookieStore = await cookies();
  const client = createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
  return client;
}
