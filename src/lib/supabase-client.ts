"use client";

import { createBrowserClient } from '@supabase/ssr';

const cleanEnv = (value: string | undefined) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const printable = trimmed.replace(/[^\x21-\x7E]/g, '');
  return printable.replace(/^['"`]+|['"`]+$/g, '');
};

const normalizeSupabaseUrl = (value: string | undefined) => {
  const cleaned = cleanEnv(value);
  if (!cleaned) return cleaned;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(cleaned)) return `https://${cleaned}`;
  return cleaned;
};

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);
const supabaseAnonKey = cleanEnv(
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined)
);

let client: ReturnType<typeof createBrowserClient> | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env missing or invalid', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    supabaseUrl,
  });
} else {
  try {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (e) {
    console.error('Failed to initialize Supabase client', e);
  }
}

export const supabase = client;
