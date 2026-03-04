import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const cleanEnv = (value: string | undefined) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.replace(/^['"`]+|['"`]+$/g, '');
  };

  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) as string;
  const anon = cleanEnv(
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined)
  ) as string;

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
