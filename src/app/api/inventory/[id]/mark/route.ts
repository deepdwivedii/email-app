import { NextRequest, NextResponse } from 'next/server';
import { updateInventoryStatus, inventoryTable, mailboxesTable, type Inventory, type Mailbox } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function POST(req: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { status } = await req.json();
    if (!['active', 'moved', 'ignored'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const { data: invs } = await inventoryTable().select('*').eq('id', params.id).limit(1);
    const inv = (invs && invs[0]) as Inventory | undefined;
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data: mbs } = await mailboxesTable().select('*').eq('id', inv.mailboxId).limit(1);
    const mb = (mbs && mbs[0]) as Mailbox | undefined;
    if (!mb || mb.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await updateInventoryStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
