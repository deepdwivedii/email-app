import { NextRequest, NextResponse } from 'next/server';
import { updateInventoryStatus } from '@/lib/server/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();
    if (!['active', 'moved', 'ignored'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    await updateInventoryStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}