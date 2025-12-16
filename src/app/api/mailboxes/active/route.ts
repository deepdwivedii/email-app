import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/server/auth';
import { mailboxesTable } from '@/lib/server/db';

export async function POST(req: NextRequest) {
  try {
    const { mailboxId, mode } = await req.json();
    if (typeof mailboxId !== 'string') {
      return NextResponse.json({ error: 'Invalid mailboxId' }, { status: 400 });
    }
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: mbs } = await (await mailboxesTable()).select('*').eq('id', mailboxId).limit(1);
    const mb = mbs && (mbs[0] as any);
    if (!mb || mb.userid !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
