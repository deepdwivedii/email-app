import { NextRequest, NextResponse } from 'next/server';
import { accountsCol, actionLogsCol, type Account } from '@/lib/server/db';
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
    const body = await req.json();
    const { actionType, target } = body || {};
    const accRef = await accountsCol().doc(params.id).get();
    if (!accRef.exists) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const acc = accRef.data() as Account;
    if (acc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const mailboxId = undefined;
    let status: 'success'|'fail'|'noop' = 'noop';
    let executionMode: 'http'|'mailto'|'link'|'manual'|'api' = 'link';
    let error: string | undefined;
    if (actionType === 'unsubscribe') {
      executionMode = 'http';
      try {
        // Delegate to existing unsubscribe API where possible
        const res = await fetch(`${req.nextUrl.origin}/api/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listUnsubscribe: body.listUnsubscribe, listUnsubscribePost: body.listUnsubscribePost, inventoryId: body.inventoryId }),
        });
        status = res.ok ? 'success' : 'fail';
        if (!res.ok) error = (await res.text()).slice(0, 256);
      } catch (e) {
        status = 'fail';
        error = (e as Error)?.message || String(e);
      }
    } else if (actionType === 'open_settings_link' && typeof target === 'string') {
      executionMode = 'link';
      status = 'success';
    } else if (actionType === 'close_account') {
      executionMode = 'manual';
      try {
        await accountsCol().doc(params.id).set({ status: 'closed' }, { merge: true });
        status = 'success';
      } catch (e) {
        status = 'fail';
        error = (e as Error)?.message || String(e);
      }
    } else if (actionType === 'update_email') {
      executionMode = 'manual';
      status = 'success';
    } else {
      executionMode = 'manual';
      status = 'noop';
    }
    const id = `${params.id}:${actionType}:${Date.now()}`;
    await actionLogsCol().doc(id).set({
      id,
      userId,
      accountId: params.id,
      mailboxId,
      actionType,
      executionMode,
      target,
      status,
      error,
      createdAt: Date.now(),
    }, { merge: true });
    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
