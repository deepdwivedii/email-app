import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable, inventoryTable, type Mailbox } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function POST(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: mbs } = await (await mailboxesTable()).select('*').eq('id', params.id).limit(1);
    const mb = (mbs && mbs[0]) as Mailbox | undefined;
    if (!mb || mb.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await (await messagesTable()).delete().eq('mailboxId', params.id);
    await (await inventoryTable()).delete().eq('mailboxId', params.id);
    const { error } = await (await mailboxesTable()).delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect mailbox' }, { status: 500 });
  }
}
