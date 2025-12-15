import { NextRequest, NextResponse } from 'next/server';
import { updateInventoryStatus, inventoryCol, mailboxesCol, type Inventory, type Mailbox } from '@/lib/server/db';
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

export async function POST(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { status } = await req.json();
    if (!['active', 'moved', 'ignored'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const invRef = await inventoryCol().doc(params.id).get();
    if (!invRef.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const inv = invRef.data() as Inventory;
    const mbRef = await mailboxesCol().doc(inv.mailboxId).get();
    if (!mbRef.exists || (mbRef.data() as Mailbox).userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await updateInventoryStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
