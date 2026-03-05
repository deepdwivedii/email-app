import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
  const key = cleanEnv(getFirstEnv(['SUPABASE_ANON_KEY']));

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/api/public') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
