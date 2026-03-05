import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const cleanEnv = (value: string | undefined) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim().replace(/\s+#.*$/, '');
    const printable = trimmed.replace(/[^\x21-\x7E]/g, '');
    return printable.replace(/^['"`]+|['"`]+$/g, '');
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

  const getValidEnv = (key: string): string | undefined => {
    const val = process.env[key];
    if (!val || val.trim() === '' || val.trim().startsWith('*')) return undefined;
    return val;
  };

  const url = normalizeSupabaseUrl(
    getValidEnv('NEXT_PUBLIC_SUPABASE_URL') ||
      getValidEnv('NEXT_PUBLIC_SUPABASE_DATABASE_URL') ||
      getValidEnv('SUPABASE_DATABASE_URL')
  );
  const anon = cleanEnv(
    getValidEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
      getValidEnv('SUPABASE_ANON_KEY') ||
      getValidEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY')
  );

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
