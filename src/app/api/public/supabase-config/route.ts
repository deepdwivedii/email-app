import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(req: NextRequest) {
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
  const anonKey = cleanEnv(
    getValidEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
      getValidEnv('SUPABASE_ANON_KEY') ||
      getValidEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY')
  );

  const debug = new URL(req.url).searchParams.get('debug') === '1';

  if (!url || !anonKey) {
    return NextResponse.json(
      {
        error: 'Missing Supabase env',
        hasUrl: !!url,
        hasKey: !!anonKey,
      },
      { status: 500 }
    );
  }

  if (debug) {
    let urlParseOk = false;
    try {
      new URL(url);
      urlParseOk = true;
    } catch {
      urlParseOk = false;
    }
    return NextResponse.json({
      ok: true,
      urlParseOk,
      urlLength: url.length,
      urlStartsWithHttps: url.startsWith('https://'),
      urlStartsWithHttp: url.startsWith('http://'),
      urlFirstCharCode: url.charCodeAt(0),
      anonKeyLength: anonKey.length,
      anonKeyFirstCharCode: anonKey.charCodeAt(0),
    });
  }

  return NextResponse.json({
    url,
    anonKey,
  });
}
