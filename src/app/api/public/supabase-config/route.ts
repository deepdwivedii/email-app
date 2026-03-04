import { NextRequest, NextResponse } from 'next/server';

const cleanEnv = (value: string | undefined) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const printable = trimmed.replace(/[^\x21-\x7E]/g, '');
  return printable.replace(/^['"`]+|['"`]+$/g, '');
};

const normalizeSupabaseUrl = (value: string | undefined) => {
  const cleaned = cleanEnv(value);
  if (!cleaned) return cleaned;
  const embedded = cleaned.match(/https?:\/\/[^\s'"`]+/i);
  if (embedded?.[0]) return embedded[0];
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(cleaned)) return `https://${cleaned}`;
  return cleaned;
};

export async function GET(req: NextRequest) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);
  const anonKey = cleanEnv(
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined) ||
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined)
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
