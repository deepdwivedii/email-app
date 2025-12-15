import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { mailboxId, mode } = await req.json();
    if (typeof mailboxId !== 'string') {
      return NextResponse.json({ error: 'Invalid mailboxId' }, { status: 400 });
    }
    const isProduction = req.nextUrl.origin.startsWith('https://');
    const resp = NextResponse.json({ ok: true });
    resp.cookies.set('mb', mailboxId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 60 * 60 * 24 * 30,
    });
    if (mode === 'merged') {
      resp.cookies.set('mb_mode', 'merged', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 60 * 60 * 24 * 30,
      });
    } else {
      resp.cookies.set('mb_mode', '', { path: '/', maxAge: -1 });
    }
    return resp;
  } catch {
    return NextResponse.json({ error: 'Failed to set active mailbox' }, { status: 500 });
  }
}
