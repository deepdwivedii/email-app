import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, inventoryTable, accountsTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: mailboxes } = await (await mailboxesTable()).select('*').eq('userId', userId);
  const { data: accounts } = await (await accountsTable()).select('*').eq('userId', userId);
  const mailboxIds = (mailboxes ?? []).map(m => m.id);
  let inventoryCount = 0;
  if (mailboxIds.length) {
    const { count } = await (await inventoryTable())
      .select('*', { count: 'exact', head: true })
      .in('mailboxId', mailboxIds);
    inventoryCount = count ?? 0;
  }
  return NextResponse.json({
    mailboxes,
    accounts,
    // For size, omit messages/evidence full export in v1; add later with pagination
    summary: {
      mailboxesCount: mailboxes?.length ?? 0,
      accountsCount: accounts?.length ?? 0,
      inventoryCount,
    },
  });
}
