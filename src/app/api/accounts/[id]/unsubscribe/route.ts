import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, emailIdentitiesTable, inventoryTable, messagesTable, type Account, type EmailIdentity, type Inventory, type Message } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: accs } = await (await accountsTable()).select('*').eq('id', params.id).limit(1);
    const acc = (accs && accs[0]) as Account | undefined;
    if (!acc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (acc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: ids } = await (await emailIdentitiesTable()).select('*').eq('id', acc.emailIdentityId).limit(1);
    const identity = (ids && ids[0]) as EmailIdentity | undefined;
    const mailboxId = identity?.mailboxId;
    if (!mailboxId) return NextResponse.json({ error: 'No mailbox for identity' }, { status: 400 });

    const { data: invs } = await (await inventoryTable())
      .select('*')
      .eq('mailboxId', mailboxId)
      .eq('rootDomain', acc.serviceDomain)
      .limit(1);
    const inv = (invs && invs[0]) as Inventory | undefined;
    if (!inv) return NextResponse.json({ error: 'No inventory for domain' }, { status: 404 });

    const { data: msgs } = await (await messagesTable())
      .select('*')
      .eq('mailboxId', mailboxId)
      .eq('rootDomain', inv.rootDomain)
      .order('receivedAt', { ascending: false })
      .limit(10);
    const msgWithUnsub = (msgs ?? []).map(m => m as Message).find(m => m.listUnsubscribe);

    return NextResponse.json({
      inventoryId: inv.id,
      rootDomain: inv.rootDomain,
      listUnsubscribe: msgWithUnsub?.listUnsubscribe,
      listUnsubscribePost: msgWithUnsub?.listUnsubscribePost,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch unsubscribe info' }, { status: 500 });
  }
}
