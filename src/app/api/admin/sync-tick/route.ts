import { NextRequest, NextResponse } from 'next/server';
import { syncWorkerTick } from '@/lib/server/sync-engine';
import { requireAdmin } from '@/lib/server/admin-auth';

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { processed } = await syncWorkerTick();
  return NextResponse.json({ processed });
}

