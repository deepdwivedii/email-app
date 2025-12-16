import { NextRequest, NextResponse } from 'next/server';
import { updateInventoryStatus, actionLogsTable, inventoryTable, mailboxesTable, type Inventory, type Mailbox } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

function parseListUnsubscribe(value: string | undefined) {
  if (!value) return { urls: [], mailtos: [] as string[] };
  const parts = value.split(',').map((s) => s.trim().replace(/^<|>$/g, ''));
  const urls = parts.filter((p) => p.startsWith('http://') || p.startsWith('https://'));
  const mailtos = parts.filter((p) => p.toLowerCase().startsWith('mailto:'));
  return { urls, mailtos };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const listUnsubscribe: string | undefined = body.listUnsubscribe;
    const listUnsubscribePost: string | undefined = body.listUnsubscribePost;
    const inventoryId: string | undefined = body.inventoryId;
    const accountId: string | undefined = body.accountId;

    const { urls, mailtos } = parseListUnsubscribe(listUnsubscribe);

    if (inventoryId) {
      const { data: invs } = await inventoryTable().select('*').eq('id', inventoryId).limit(1);
      const inv = (invs && invs[0]) as Inventory | undefined;
      if (!inv) return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
      const { data: mbs } = await mailboxesTable().select('*').eq('id', inv.mailboxId).limit(1);
      const mb = (mbs && mbs[0]) as Mailbox | undefined;
      if (!mb || mb.userId !== userId) {
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
        try {
          await actionLogsTable()
            .upsert({
              id,
              userId,
              accountId,
              actionType: 'unsubscribe',
              executionMode: 'http',
              target: url,
              status: 'success',
              createdAt: Date.now(),
            })
            .eq('id', id);
        } catch {}
        return NextResponse.json({ status: 'ok', method: 'http', url });
      }
    }

    if (!attempted && mailtos.length) {
      // In a real deployment, you would send an email with subject "unsubscribe"
      // For safety in demo, just acknowledge
      if (inventoryId) await updateInventoryStatus(inventoryId, 'ignored');
      const id = `${Date.now()}:unsubscribe:mailto`;
      try {
        await actionLogsTable()
          .upsert({
            id,
            userId,
            accountId,
            actionType: 'unsubscribe',
            executionMode: 'mailto',
            target: mailtos[0],
            status: 'success',
            createdAt: Date.now(),
          })
          .eq('id', id);
      } catch {}
      return NextResponse.json({ status: 'ack', method: 'mailto', to: mailtos[0] });
    }

    return NextResponse.json({ status: 'noop' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 });
  }
}
