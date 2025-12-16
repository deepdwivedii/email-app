import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, accountEvidenceTable, type Account } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest, context: unknown) {
  const params = (context as { params: { id: string } }).params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: accs } = await (await accountsTable()).select('*').eq('id', params.id).limit(1);
  const row = accs && (accs[0] as any);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.userid !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const account: Account = {
    id: row.id,
    userId: row.userid,
    emailIdentityId: row.emailidentityid,
    serviceName: row.servicename,
    serviceDomain: row.servicedomain,
    category: row.category,
    confidenceScore: row.confidencescore ?? 0,
    explanation: row.explanation,
    firstSeenAt: row.firstseenat,
    lastSeenAt: row.lastseenat,
    status: row.status,
  };
  const { data: evRows } = await (await accountEvidenceTable())
    .select('*')
    .eq('accountid', params.id)
    .order('createdat', { ascending: false })
    .limit(100);
  const evidence = (evRows ?? []).map((r: any) => ({
    id: r.id,
    userId: r.userid,
    accountId: r.accountid,
    mailboxId: r.mailboxid,
    messageId: r.messageid,
    evidenceType: r.evidencetype,
    excerpt: r.excerpt ?? undefined,
    signals: r.signals,
    weight: r.weight,
    createdAt: r.createdat,
  }));
  return NextResponse.json({ account, evidence });
}
