import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
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

    const supabaseUrl = getFirstEnv([
      'SUPABASE_URL',
      'SUPABASE_DATABASE_URL',
    ]);
    const supabaseAnonKey = getFirstEnv(['SUPABASE_ANON_KEY']);

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            cookiesToSet: { name: string; value: string; options?: any }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
