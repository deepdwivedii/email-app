import { NextRequest, NextResponse } from 'next/server';
import { accountsTable, type Account } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ accounts: [] });
  const { searchParams } = new URL(req.url);
  const emailIdentityId = searchParams.get('emailIdentityId') || undefined;
  const category = searchParams.get('category') || undefined;
  const status = searchParams.get('status') || undefined;
  const minConfidence = Number(searchParams.get('minConfidence') || '0');

  let query = (await accountsTable()).select('*').eq('userid', userId);
  if (emailIdentityId) query = query.eq('emailidentityid', emailIdentityId);
  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  const { data } = await query.order('lastseenat', { ascending: false }).limit(500);
  const accounts = (data ?? []).map((row: any) => ({
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
  }) as Account).filter(a => a.confidenceScore >= minConfidence);
  return NextResponse.json({ accounts });
}
