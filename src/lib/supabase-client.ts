"use client";

import { createBrowserClient } from '@supabase/ssr';

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

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

let client: BrowserSupabaseClient | null = null;
let initPromise: Promise<BrowserSupabaseClient | null> | null = null;

function createClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

const getValidEnv = (key: string): string | undefined => {
  const val = process.env[key];
  if (!val || val.trim() === '' || val.trim().startsWith('*')) return undefined;
  return val;
};

async function initFromEnv(): Promise<BrowserSupabaseClient | null> {
  const supabaseUrl = normalizeSupabaseUrl(
    getValidEnv('NEXT_PUBLIC_SUPABASE_URL') ||
      getValidEnv('NEXT_PUBLIC_SUPABASE_DATABASE_URL')
  );
  const supabaseAnonKey = cleanEnv(
    getValidEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
      getValidEnv('SUPABASE_ANON_KEY') ||
      getValidEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY')
  );

  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    new URL(supabaseUrl);
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch {
    console.error('Supabase env config invalid', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlLength: supabaseUrl.length,
      urlStartsWithHttps: supabaseUrl.startsWith('https://'),
      urlFirstCharCode: supabaseUrl.charCodeAt(0),
    });
    return null;
  }
}

async function initFromServer(): Promise<BrowserSupabaseClient | null> {
  try {
    const res = await fetch('/api/public/supabase-config', { cache: 'no-store' });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.url || !j?.anonKey) {
      console.error('Supabase config fetch failed', {
        status: res.status,
        ok: res.ok,
        hasUrl: !!j?.url,
        hasKey: !!j?.anonKey,
      });
      return null;
    }
    const url = normalizeSupabaseUrl(String(j.url));
    const anonKey = cleanEnv(String(j.anonKey));
    if (!url || !anonKey) return null;
    try {
      new URL(url);
      return createClient(url, anonKey);
    } catch {
      console.error('Supabase server config invalid', {
        urlLength: url.length,
        urlStartsWithHttps: url.startsWith('https://'),
        urlFirstCharCode: url.charCodeAt(0),
        anonKeyLength: anonKey.length,
      });
      return null;
    }
  } catch {
    console.error('Supabase config request failed');
    return null;
  }
}

export function getSupabaseClientSync() {
  return client;
}

export async function getSupabaseClient() {
  if (client) return client;
  if (typeof window === 'undefined') return null;
  if (!initPromise) {
    initPromise = (async () => {
      const fromEnv = await initFromEnv();
      if (fromEnv) return fromEnv;
      return initFromServer();
    })();
  }
  client = await initPromise;
  return client;
}
