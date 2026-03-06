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
  const { searchParams } = new URL(req.url);
  const mailboxId = searchParams.get('mailboxId');
  const status = searchParams.get('status');
  const limitParam = searchParams.get('limit');
  let limit = 50;
  if (limitParam) {
    const parsed = Number(limitParam);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 100);
    }
  }

  let query = supabase
    .from('sync_runs')
    .select('id,userid,mailboxid,mode,status,stage,startedat,finishedat,importedcount,cursorsnapshot,error')
    .order('startedat', { ascending: false })
    .limit(limit);

  if (mailboxId) {
    query = query.eq('mailboxid', mailboxId);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    runs: data ?? [],
  });
}

