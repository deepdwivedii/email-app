import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, emailIdentitiesTable, inventoryTable, messagesTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: accs } = await (await accountsTable()).select('*').eq('id', params.id).limit(1);
    const accRow = accs && accs[0] as { userid: string; emailidentityid: string; servicedomain: string };
    if (!accRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (accRow.userid !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: ids } = await (await emailIdentitiesTable()).select('*').eq('id', accRow.emailidentityid).limit(1);
    const identity = ids && ids[0] as { mailboxid: string } | null;
    const mailboxId = identity?.mailboxid as string | undefined;
    if (!mailboxId) return NextResponse.json({ error: 'No mailbox for identity' }, { status: 400 });

    const { data: invs } = await (await inventoryTable())
      .select('*')
      .eq('mailboxid', mailboxId)
      .eq('rootdomain', accRow.servicedomain)
      .limit(1);
    const inv = invs && invs[0] as { id: string; rootdomain: string } | null;
    if (!inv) return NextResponse.json({ error: 'No inventory for domain' }, { status: 404 });

    const { data: msgs } = await (await messagesTable())
      .select('*')
      .eq('mailboxid', mailboxId)
      .eq('rootdomain', inv.rootdomain)
      .order('receivedat', { ascending: false })
      .limit(10);
    const msgWithUnsub = (msgs ?? []).find(m => m.listunsubscribe);

    return NextResponse.json({
      inventoryId: inv.id,
      rootDomain: inv.rootdomain,
      listUnsubscribe: msgWithUnsub?.listunsubscribe,
      listUnsubscribePost: msgWithUnsub?.listunsubscribepost,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch unsubscribe info' }, { status: 500 });
  }
}
