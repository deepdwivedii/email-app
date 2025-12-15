import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { accountsCol, type Account } from '@/lib/server/db';

async function getUserId(req: NextRequest) {
  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getAuth(firebaseAdminApp).verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ accounts: [] });
  const { searchParams } = new URL(req.url);
  const emailIdentityId = searchParams.get('emailIdentityId') || undefined;
  const category = searchParams.get('category') || undefined;
  const status = searchParams.get('status') || undefined;
  const minConfidence = Number(searchParams.get('minConfidence') || '0');

  let q: FirebaseFirestore.Query = accountsCol().where('userId', '==', userId);
  if (emailIdentityId) q = q.where('emailIdentityId', '==', emailIdentityId);
  if (category) q = q.where('category', '==', category);
  if (status) q = q.where('status', '==', status);
  const snap = await q.orderBy('lastSeenAt', 'desc').limit(500).get();
  const accounts = snap.docs.map(d => d.data() as Account).filter(a => a.confidenceScore >= minConfidence);
  return NextResponse.json({ accounts });
}
