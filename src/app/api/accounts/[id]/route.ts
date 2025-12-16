import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, accountEvidenceTable, type Account } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest, context: unknown) {
  const params = (context as { params: { id: string } }).params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: accs } = await (await accountsTable()).select('*').eq('id', params.id).limit(1);
  const acc = (accs && accs[0]) as Account | undefined;
  if (!acc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (acc.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data: evidence } = await (await accountEvidenceTable())
    .select('*')
    .eq('accountId', params.id)
    .order('createdAt', { ascending: false })
    .limit(100);
  return NextResponse.json({ account: acc, evidence });
}
