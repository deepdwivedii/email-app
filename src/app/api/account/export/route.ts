import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { mailboxesCol, inventoryCol, accountsCol } from '@/lib/server/db';

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

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const mb = await mailboxesCol().where('userId', '==', userId).get();
  const acc = await accountsCol().where('userId', '==', userId).get();
  const mailboxIds = mb.docs.map(d => d.id);
  let inventoryDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  if (mailboxIds.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < mailboxIds.length; i += 10) {
      chunks.push(mailboxIds.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      try {
        const snap = await inventoryCol().where('mailboxId', 'in', chunk).get();
        inventoryDocs = inventoryDocs.concat(snap.docs);
      } catch {}
    }
  }
  return NextResponse.json({
    mailboxes: mb.docs.map(d => d.data()),
    accounts: acc.docs.map(d => d.data()),
    // For size, omit messages/evidence full export in v1; add later with pagination
    summary: {
      mailboxesCount: mb.size,
      accountsCount: acc.size,
      inventoryCount: inventoryDocs.length,
    },
  });
}
