import { NextRequest, NextResponse } from 'next/server';
import { actionLogsTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ logs: [] }, { status: 200 });
  const { data } = await (await actionLogsTable())
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(200);
  return NextResponse.json({ logs: data ?? [] });
}
