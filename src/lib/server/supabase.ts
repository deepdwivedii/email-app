import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : rawUrl;
  const rawAnon =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string);
  const anon = typeof rawAnon === 'string' ? rawAnon.trim() : rawAnon;

  const cookieStore = await cookies();
  const client = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
  return client;
}
