import { NextRequest, NextResponse } from 'next/server';
import { updateInventoryStatus, actionLogsCol, inventoryCol, mailboxesCol, type Inventory, type Mailbox } from '@/lib/server/db';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';

function parseListUnsubscribe(value: string | undefined) {
  if (!value) return { urls: [], mailtos: [] as string[] };
  const parts = value.split(',').map((s) => s.trim().replace(/^<|>$/g, ''));
  const urls = parts.filter((p) => p.startsWith('http://') || p.startsWith('https://'));
  const mailtos = parts.filter((p) => p.toLowerCase().startsWith('mailto:'));
  return { urls, mailtos };
}

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('__session')?.value;
    if (!cookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await getAuth(firebaseAdminApp).verifySessionCookie(cookie, true).catch(() => null);
    const userId = decoded?.uid;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const listUnsubscribe: string | undefined = body.listUnsubscribe;
    const listUnsubscribePost: string | undefined = body.listUnsubscribePost;
    const inventoryId: string | undefined = body.inventoryId;
    const accountId: string | undefined = body.accountId;

    const { urls, mailtos } = parseListUnsubscribe(listUnsubscribe);

    if (inventoryId) {
      const invRef = await inventoryCol().doc(inventoryId).get();
      if (!invRef.exists) return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
      const inv = invRef.data() as Inventory;
      const mbRef = await mailboxesCol().doc(inv.mailboxId).get();
      if (!mbRef.exists || (mbRef.data() as Mailbox).userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // RFC 8058 One-Click: prefer POST with List-Unsubscribe=One-Click header
    let attempted = false;
    for (const url of urls) {
      attempted = true;
      const res = await fetch(url, {
        method: listUnsubscribePost?.toLowerCase().includes('one-click') ? 'POST' : 'GET',
        headers: listUnsubscribePost?.toLowerCase().includes('one-click')
          ? { 'List-Unsubscribe': 'One-Click' }
          : undefined,
      });
      if (res.ok) {
        if (inventoryId) await updateInventoryStatus(inventoryId, 'ignored');
        const id = `${Date.now()}:unsubscribe:http`;
        await actionLogsCol().doc(id).set({
          id,
          userId,
          accountId,
          actionType: 'unsubscribe',
          executionMode: 'http',
          target: url,
          status: 'success',
          createdAt: Date.now(),
        }, { merge: true }).catch(() => {});
        return NextResponse.json({ status: 'ok', method: 'http', url });
      }
    }

    if (!attempted && mailtos.length) {
      // In a real deployment, you would send an email with subject "unsubscribe"
      // For safety in demo, just acknowledge
      if (inventoryId) await updateInventoryStatus(inventoryId, 'ignored');
      const id = `${Date.now()}:unsubscribe:mailto`;
      await actionLogsCol().doc(id).set({
        id,
        userId,
        accountId,
        actionType: 'unsubscribe',
        executionMode: 'mailto',
        target: mailtos[0],
        status: 'success',
        createdAt: Date.now(),
      }, { merge: true }).catch(() => {});
      return NextResponse.json({ status: 'ack', method: 'mailto', to: mailtos[0] });
    }

    return NextResponse.json({ status: 'noop' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 });
  }
}
