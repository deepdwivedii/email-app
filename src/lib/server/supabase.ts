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
    // If the value is a placeholder or masked (e.g. starts with *), ignore it
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
      getValidEnv('SUPABASE_DATABASE_URL') ||
      "https://mxyimbouftlqkhewffvd.supabase.co"
  ) as string;
  const anon = cleanEnv(
    getValidEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
      getValidEnv('SUPABASE_ANON_KEY') ||
      getValidEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY') ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eWltYm91ZnRscWtoZXdmZnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDE4MjQsImV4cCI6MjA4ODAxNzgyNH0.wJR2wVxAYUf0pX86fBfXzxCAnjBuzo32V2AzFBPQ26o"
  ) as string;

  const cookieStore = await cookies();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
  return client;
}
