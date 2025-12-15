import { NextRequest, NextResponse } from 'next/server';
import { accountsCol, emailIdentitiesCol, inventoryCol, messagesCol, type Account, type EmailIdentity, type Inventory, type Message } from '@/lib/server/db';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';

async function getUserId(req: NextRequest) {
  const cookie = req.cookies.get('__session')?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAuth(firebaseAdminApp).verifySessionCookie(cookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accRef = await accountsCol().doc(params.id).get();
    if (!accRef.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const acc = accRef.data() as Account;
    if (acc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const identityRef = await emailIdentitiesCol().doc(acc.emailIdentityId).get();
    const identity = identityRef.data() as EmailIdentity | undefined;
    const mailboxId = identity?.mailboxId;
    if (!mailboxId) return NextResponse.json({ error: 'No mailbox for identity' }, { status: 400 });

    const invSnap = await inventoryCol().where('mailboxId', '==', mailboxId).where('rootDomain', '==', acc.serviceDomain).limit(1).get();
    const inv = invSnap.docs[0]?.data() as Inventory | undefined;
    if (!inv) return NextResponse.json({ error: 'No inventory for domain' }, { status: 404 });

    const msgsSnap = await messagesCol()
      .where('mailboxId', '==', mailboxId)
      .where('rootDomain', '==', inv.rootDomain)
      .orderBy('receivedAt', 'desc')
      .limit(10)
      .get();
    const msgWithUnsub = msgsSnap.docs.map(d => d.data() as Message).find(m => m.listUnsubscribe);

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
