import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable, inventoryTable, accountsTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ authorized: false, summary: null }, { status: 401 });
  }

  const mailboxesClient = await mailboxesTable();
  const { data: mbs, error: mbError } = await mailboxesClient.select('*').eq('userid', userId);
  if (mbError) {
    return NextResponse.json({ authorized: true, error: mbError.message, summary: null }, { status: 500 });
  }

  const mailboxes = mbs ?? [];
  if (!mailboxes.length) {
    return NextResponse.json({
      authorized: true,
      summary: {
        mailboxCount: 0,
        totalMessages: 0,
        totalDomains: 0,
        unsubscribedDomains: 0,
        totalAccounts: 0,
        lastSyncAt: null,
      },
    });
  }

  const mailboxIds = mailboxes.map((m: any) => m.id as string);
  const lastSyncAt = mailboxes.reduce<number | null>((acc, m: any) => {
    const v = m.lastsyncat ? Number(m.lastsyncat) : null;
    if (v && (!acc || v > acc)) return v;
    return acc;
  }, null);

  const messagesClient = await messagesTable();
  const { count: messageCount, error: msgError } = await messagesClient
    .select('*', { count: 'exact', head: true })
    .in('mailboxid', mailboxIds);
  if (msgError) {
    return NextResponse.json({ authorized: true, error: msgError.message, summary: null }, { status: 500 });
  }

  const inventoryClient = await inventoryTable();
  const { count: domainCount, error: invError } = await inventoryClient
    .select('*', { count: 'exact', head: true })
    .in('mailboxid', mailboxIds);
  if (invError) {
    return NextResponse.json({ authorized: true, error: invError.message, summary: null }, { status: 500 });
  }

  const { count: unsubCount, error: unsubError } = await inventoryClient
    .select('*', { count: 'exact', head: true })
    .in('mailboxid', mailboxIds)
    .eq('status', 'ignored');
  if (unsubError) {
    return NextResponse.json({ authorized: true, error: unsubError.message, summary: null }, { status: 500 });
  }

  const accountsClient = await accountsTable();
  const { count: accountCount, error: accError } = await accountsClient
    .select('*', { count: 'exact', head: true })
    .eq('userid', userId);
  if (accError) {
    return NextResponse.json({ authorized: true, error: accError.message, summary: null }, { status: 500 });
  }

  return NextResponse.json({
    authorized: true,
    summary: {
      mailboxCount: mailboxes.length,
      totalMessages: messageCount ?? 0,
      totalDomains: domainCount ?? 0,
      unsubscribedDomains: unsubCount ?? 0,
      totalAccounts: accountCount ?? 0,
      lastSyncAt,
    },
  });
}

