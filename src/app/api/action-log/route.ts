import { NextRequest, NextResponse } from 'next/server';
import { actionLogsCol } from '@/lib/server/db';
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

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ logs: [] }, { status: 200 });
  const q: FirebaseFirestore.Query = actionLogsCol().where('userId', '==', userId);
  const snap = await q.orderBy('createdAt', 'desc').limit(200).get();
  return NextResponse.json({ logs: snap.docs.map(d => d.data()) });
}
