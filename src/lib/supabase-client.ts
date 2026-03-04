"use client";

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined);

let client: ReturnType<typeof createBrowserClient> | null = null;

const looksLikeUrl = (value: string | undefined) =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

if (!supabaseUrl || !supabaseAnonKey || !looksLikeUrl(supabaseUrl)) {
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
