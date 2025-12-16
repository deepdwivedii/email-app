import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable, inventoryTable, accountsTable, accountEvidenceTable, tasksTable, actionLogsTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

async function deleteTableByUser(tablePromise: Promise<any>, userId: string, field: string = 'userId') {
  const table = await tablePromise;
  await table.delete().eq(field, userId);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // collect mailbox ids first to delete messages/inventory
  const { data: mbs } = await (await mailboxesTable()).select('id').eq('userId', userId);
  for (const mb of mbs ?? []) {
    const mailboxId = mb.id as string;
    await (await messagesTable()).delete().eq('mailboxId', mailboxId);
    await (await inventoryTable()).delete().eq('mailboxId', mailboxId);
  }
  await Promise.all([
    deleteTableByUser(accountsTable(), userId),
    deleteTableByUser(accountEvidenceTable(), userId),
    deleteTableByUser(tasksTable(), userId),
    deleteTableByUser(actionLogsTable(), userId),
    deleteTableByUser(mailboxesTable(), userId),
  ]);
  return NextResponse.json({ ok: true });
}
