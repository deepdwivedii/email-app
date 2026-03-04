import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable, inventoryTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

type Params = {
  params: {
    id: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: mbs } = await (await mailboxesTable()).select('*').eq('id', params.id).limit(1);
    const row = mbs && mbs[0] as { userid: string } | null;
    if (!row || row.userid !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await (await messagesTable()).delete().eq('mailboxid', params.id);
    await (await inventoryTable()).delete().eq('mailboxid', params.id);
    const { error } = await (await mailboxesTable()).delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect mailbox' }, { status: 500 });
  }
}
