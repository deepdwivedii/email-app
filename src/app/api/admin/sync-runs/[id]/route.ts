import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/server/supabase';
import { requireAdmin } from '@/lib/server/admin-auth';

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('sync_runs')
    .select('*')
    .eq('id', params.id)
    .limit(1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = data && data[0];
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ run: row });
}

