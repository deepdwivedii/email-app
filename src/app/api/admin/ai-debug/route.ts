import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/server/supabase';
import { requireAdmin } from '@/lib/server/admin-auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await getServerSupabase();

  const queuePromise = supabase
    .from('ai_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const actionsPromise = supabase
    .from('action_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const [queueRes, actionsRes] = await Promise.all([queuePromise, actionsPromise]);

  if (queueRes.error) {
    return NextResponse.json({ error: queueRes.error.message }, { status: 500 });
  }
  if (actionsRes.error) {
    return NextResponse.json({ error: actionsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    queue: queueRes.data ?? [],
    actions: actionsRes.data ?? [],
  });
}

