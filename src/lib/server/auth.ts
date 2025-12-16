import { NextRequest } from 'next/server';
import { getServerSupabase } from './supabase';

export async function getUserId(req: NextRequest) {
  void req;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
