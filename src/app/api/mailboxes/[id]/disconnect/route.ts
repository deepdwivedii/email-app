import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { mailboxesCol, messagesCol, inventoryCol, type Mailbox } from '@/lib/server/db';

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

export async function POST(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mbDoc = await mailboxesCol().doc(params.id).get();
    if (!mbDoc.exists || (mbDoc.data() as Mailbox).userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const msgs = await messagesCol().where('mailboxId', '==', params.id).limit(500).get();
    const invs = await inventoryCol().where('mailboxId', '==', params.id).limit(500).get();
    const batch = messagesCol().firestore.batch();
    msgs.docs.forEach(d => batch.delete(d.ref));
    invs.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await mailboxesCol().doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect mailbox' }, { status: 500 });
  }
}
