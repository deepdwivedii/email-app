import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/server/auth';
import { mailboxesTable } from '@/lib/server/db';
import { startSyncRun } from '@/lib/server/sync-engine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  type StartBody = { mailboxId?: string; mode?: string };
  let body: StartBody = {};
  try {
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      body = await req.json();
    }
  } catch {
  }

  const cookieMailboxId = req.cookies.get('mb')?.value;
  let mailboxId = body.mailboxId || cookieMailboxId;
  const mode = body.mode === 'quick' || body.mode === 'full' || body.mode === 'delta' ? (body.mode as 'quick' | 'full' | 'delta') : 'full';

  if (!mailboxId) {
    const { data } = await (await mailboxesTable())
      .select('id')
      .eq('userid', userId)
      .order('connectedat', { ascending: false })
      .limit(1);
    mailboxId = (data?.[0]?.id as string | undefined) || undefined;
    if (!mailboxId) {
      return NextResponse.json({ error: 'No mailboxes connected' }, { status: 400 });
    }
  }

  try {
    const run = await startSyncRun(userId, mailboxId, mode);
    const resp = NextResponse.json({ run });
    if (!cookieMailboxId) {
      const isProduction = req.nextUrl.origin.startsWith('https://');
      resp.cookies.set('mb', mailboxId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return resp;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
