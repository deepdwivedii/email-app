import { NextRequest, NextResponse } from 'next/server';
import { aiWorkerTick } from '@/lib/server/ai-worker';

export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_WORKER_SECRET;
  const headerSecret =
    req.headers.get('x-internal-secret') ||
    req.headers.get('X-Internal-Secret');
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { processed } = await aiWorkerTick();
  return NextResponse.json({ processed });
}

