import { NextRequest, NextResponse } from 'next/server';
import { tasksTable, type Task } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ tasks: [] }, { status: 200 });
  const { data } = await (await tasksTable())
    .select('*')
    .eq('userid', userId)
    .order('createdat', { ascending: false })
    .limit(200);
  const tasks = (data ?? []).map((t: any) => ({
    id: t.id,
    userId: t.userid,
    accountId: t.accountid ?? undefined,
    title: t.title,
    type: t.type,
    status: t.status,
    dueAt: t.dueat ?? undefined,
    createdAt: t.createdat,
  })) as Task[];
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const id = body.id || String(Date.now());
    const { error } = await (await tasksTable()).upsert({
      id,
      userid: userId,
      accountid: body.accountId,
      title: body.title,
      type: body.type,
      status: body.status || 'open',
      dueat: body.dueAt,
      createdat: Date.now(),
    }, { onConflict: 'id' });
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
    const { data } = await (await tasksTable()).select('userid').eq('id', id).limit(1);
    const docUserId = data && data[0]?.userid;
    if (!docUserId || docUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { error } = await (await tasksTable()).update({
      status: body.status,
      dueat: body.dueAt,
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
    const { data } = await (await tasksTable()).select('userid').eq('id', id).limit(1);
    const docUserId = data && data[0]?.userid;
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
