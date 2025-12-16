import { NextRequest, NextResponse } from 'next/server';
import { tasksTable, type Task } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ tasks: [] }, { status: 200 });
  const { data } = await (await tasksTable())
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(200);
  return NextResponse.json({ tasks: (data ?? []) as Task[] });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const id = body.id || String(Date.now());
    const { error } = await (await tasksTable()).upsert({
      id,
      userId,
      accountId: body.accountId,
      title: body.title,
      type: body.type,
      status: body.status || 'open',
      dueAt: body.dueAt,
      createdAt: Date.now(),
    }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to write task' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const id = body.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { data } = await (await tasksTable()).select('userId').eq('id', id).limit(1);
    const docUserId = data && data[0]?.userId;
    if (!docUserId || docUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { error } = await (await tasksTable()).update({
      status: body.status,
      dueAt: body.dueAt,
      title: body.title,
      type: body.type,
    }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { data } = await (await tasksTable()).select('userId').eq('id', id).limit(1);
    const docUserId = data && data[0]?.userId;
    if (!docUserId || docUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { error } = await (await tasksTable()).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
