import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/server/auth';
import { getLatestSyncRun } from '@/lib/server/sync-engine';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const queryMailboxId = searchParams.get('mailboxId');
  const cookieMailboxId = req.cookies.get('mb')?.value;
  const mailboxId = queryMailboxId || cookieMailboxId;
  if (!mailboxId) {
    return NextResponse.json({ error: 'Missing mailboxId' }, { status: 400 });
  }
  const run = await getLatestSyncRun(userId, mailboxId);
  if (!run) {
    return NextResponse.json({ run: null });
  }
  return NextResponse.json({ run });
}

