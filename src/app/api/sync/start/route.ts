import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/server/auth';
import { startSyncRun } from '@/lib/server/sync-engine';

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
  const mailboxId = body.mailboxId || cookieMailboxId;
  const mode = body.mode === 'quick' || body.mode === 'full' || body.mode === 'delta' ? (body.mode as 'quick' | 'full' | 'delta') : 'full';

  if (!mailboxId) {
    return NextResponse.json({ error: 'Missing mailboxId' }, { status: 400 });
  }

  try {
    const run = await startSyncRun(userId, mailboxId, mode);
    return NextResponse.json({ run });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
