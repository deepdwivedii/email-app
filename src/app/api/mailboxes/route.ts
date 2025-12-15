import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { mailboxesCol, emailIdentitiesCol } from '@/lib/server/db';

async function getUserIdFromSessionCookie(req: NextRequest) {
  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decodedToken = await getAuth(firebaseAdminApp).verifySessionCookie(sessionCookie, true);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromSessionCookie(req);
  if (!userId) return NextResponse.json({ mailboxes: [], identities: [] });
  const [mbSnap, idSnap] = await Promise.all([
    mailboxesCol().where('userId', '==', userId).get(),
    emailIdentitiesCol().where('userId', '==', userId).get(),
  ]);
  const mailboxes = mbSnap.docs.map(d => d.data());
  const identities = idSnap.docs.map(d => d.data());
  return NextResponse.json({ mailboxes, identities });
}

