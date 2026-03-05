import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const cleanEnv = (value: string | undefined) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().replace(/\s+#.*$/, '');
    const printable = trimmed.replace(/[^\x21-\x7E]/g, '');
    return printable.replace(/^['"`]+|['"`]+$/g, '');
  };

  const getFirstEnv = (keys: string[]) => {
    for (const key of keys) {
      const value = cleanEnv(process.env[key]);
      if (value && !value.startsWith('*')) return value;
    }
    return undefined;
  };

  const normalizeSupabaseUrl = (value: string | undefined) => {
    const cleaned = cleanEnv(value);
    if (!cleaned) return cleaned;
    if (cleaned.startsWith('*')) return undefined;

    const embedded = cleaned.match(/https?:\/\/[^\s'"`]+/i);
    if (embedded?.[0]) return embedded[0];
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    if (/^[a-z0-9-]+\.supabase\.co$/i.test(cleaned)) return `https://${cleaned}`;
    return cleaned;
  };

  const url = normalizeSupabaseUrl(
    getFirstEnv([
      'SUPABASE_URL',
      'SUPABASE_DATABASE_URL',
    ])
  );
  const anon = cleanEnv(getFirstEnv(['SUPABASE_ANON_KEY']));

  if (!url || !anon) {
    throw new Error('Missing Supabase environment variables');
  }

  const cookieStore = await cookies();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          void error;
        }
      },
    },
  });
  return client;
}
