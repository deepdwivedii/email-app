import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, emailIdentitiesTable, inventoryTable, messagesTable, type Account, type EmailIdentity, type Inventory, type Message } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: accs } = await (await accountsTable()).select('*').eq('id', params.id).limit(1);
    const accRow = accs && (accs[0] as any);
    if (!accRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (accRow.userid !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: ids } = await (await emailIdentitiesTable()).select('*').eq('id', accRow.emailidentityid).limit(1);
    const identity = ids && (ids[0] as any);
    const mailboxId = identity?.mailboxid as string | undefined;
    if (!mailboxId) return NextResponse.json({ error: 'No mailbox for identity' }, { status: 400 });

    const { data: invs } = await (await inventoryTable())
      .select('*')
      .eq('mailboxid', mailboxId)
      .eq('rootdomain', accRow.servicedomain)
      .limit(1);
    const inv = invs && (invs[0] as any);
    if (!inv) return NextResponse.json({ error: 'No inventory for domain' }, { status: 404 });

    const { data: msgs } = await (await messagesTable())
      .select('*')
      .eq('mailboxid', mailboxId)
      .eq('rootdomain', inv.rootdomain)
      .order('receivedat', { ascending: false })
      .limit(10);
    const msgWithUnsub = (msgs ?? []).map((m: any) => m).find((m: any) => m.listunsubscribe);

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
