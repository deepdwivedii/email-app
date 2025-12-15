import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { mailboxesCol, messagesCol, inventoryCol, accountsCol, accountEvidenceCol, tasksCol, actionLogsCol } from '@/lib/server/db';

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

async function deleteCollectionByUser(col: FirebaseFirestore.CollectionReference, userId: string, field: string = 'userId') {
  const snap = await col.where(field, '==', userId).limit(500).get();
  const batch = col.firestore.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // collect mailbox ids first to delete messages/inventory
  const mbs = await mailboxesCol().where('userId', '==', userId).get();
  for (const mb of mbs.docs) {
    const mailboxId = mb.id;
    const msgs = await messagesCol().where('mailboxId', '==', mailboxId).limit(500).get();
    const invs = await inventoryCol().where('mailboxId', '==', mailboxId).limit(500).get();
    const batch = messagesCol().firestore.batch();
    msgs.docs.forEach(d => batch.delete(d.ref));
    invs.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  await Promise.all([
    deleteCollectionByUser(accountsCol(), userId),
    deleteCollectionByUser(accountEvidenceCol(), userId),
    deleteCollectionByUser(tasksCol(), userId),
    deleteCollectionByUser(actionLogsCol(), userId),
    deleteCollectionByUser(mailboxesCol(), userId),
  ]);
  return NextResponse.json({ ok: true });
}
