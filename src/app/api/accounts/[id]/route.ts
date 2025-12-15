import { NextRequest, NextResponse } from 'next/server';
import { accountsCol, accountEvidenceCol, type Account, type AccountEvidence } from '@/lib/server/db';
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
  const params = (context as { params: { id: string } }).params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accRef = await accountsCol().doc(params.id).get();
  if (!accRef.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const acc = accRef.data() as Account;
  if (acc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const evidenceSnap = await accountEvidenceCol().where('accountId', '==', params.id).orderBy('createdAt', 'desc').limit(100).get();
  const evidence = evidenceSnap.docs.map(d => d.data() as AccountEvidence);
  return NextResponse.json({ account: acc, evidence });
}
