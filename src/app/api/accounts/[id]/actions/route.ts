import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, actionLogsTable, type Account } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function POST(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { actionType, target } = body || {};
    const { data: accs } = await accountsTable().select('*').eq('id', params.id).limit(1);
    const acc = (accs && accs[0]) as Account | undefined;
    if (!acc) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
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
        const { error: updErr } = await accountsTable().update({ status: 'closed' }).eq('id', params.id);
        if (updErr) throw updErr;
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
    const { error: logErr } = await actionLogsTable().upsert({
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
    }).eq('id', id);
    if (logErr) return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
