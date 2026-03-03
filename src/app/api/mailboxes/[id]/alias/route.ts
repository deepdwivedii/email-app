import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function POST(req: NextRequest, context: unknown) {
  try {
    const { params } = context as { params: { id: string } };
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const displayNameRaw = typeof body.displayName === 'string' ? body.displayName : '';
    const displayName = displayNameRaw.trim() || null;

    const { data: mbs } = await (await mailboxesTable()).select('*').eq('id', params.id).limit(1);
    const row = mbs && (mbs[0] as any);
    if (!row || row.userid !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await (await mailboxesTable()).update({ displayname: displayName }).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Update mailbox alias error', e);
    return NextResponse.json({ error: 'Failed to update alias' }, { status: 500 });
  }
}

