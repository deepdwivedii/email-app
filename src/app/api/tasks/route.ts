import { NextRequest, NextResponse } from 'next/server';
import { tasksCol, type Task } from '@/lib/server/db';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';

async function getUserId(req: NextRequest) {
  const cookie = req.cookies.get('__session')?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAuth(firebaseAdminApp).verifySessionCookie(cookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ tasks: [] }, { status: 200 });
  const q: FirebaseFirestore.Query = tasksCol().where('userId', '==', userId);
  const snap = await q.orderBy('createdAt', 'desc').limit(200).get();
  return NextResponse.json({ tasks: snap.docs.map(d => d.data() as Task) });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const id = body.id || String(Date.now());
    await tasksCol().doc(id).set({
      id,
      userId,
      accountId: body.accountId,
      title: body.title,
      type: body.type,
      status: body.status || 'open',
      dueAt: body.dueAt,
      createdAt: Date.now(),
    }, { merge: true });
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
    const ref = tasksCol().doc(id);
    const doc = await ref.get();
    if (!doc.exists || (doc.data() as Task).userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ref.set({
      status: body.status,
      dueAt: body.dueAt,
      title: body.title,
      type: body.type,
    }, { merge: true });
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
    const ref = tasksCol().doc(id);
    const doc = await ref.get();
    if (!doc.exists || (doc.data() as Task).userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
