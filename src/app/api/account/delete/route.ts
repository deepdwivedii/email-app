import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable, inventoryTable, accountsTable, accountEvidenceTable, tasksTable, actionLogsTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

async function deleteTableByUser(tablePromise: Promise<unknown>, userId: string, field: string = 'userid') {
  const table = await tablePromise as { delete: () => { eq: (f: string, v: string) => Promise<unknown> } };
  await table.delete().eq(field, userId);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: mbs } = await (await mailboxesTable()).select('id').eq('userid', userId);
  for (const mb of mbs ?? []) {
    const mailboxId = mb.id as string;
    await (await messagesTable()).delete().eq('mailboxid', mailboxId);
    await (await inventoryTable()).delete().eq('mailboxid', mailboxId);
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
