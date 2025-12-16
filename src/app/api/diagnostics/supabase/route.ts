import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/server/supabase';
import { getUserId } from '@/lib/server/auth';

type CheckResult = {
  ok: boolean;
  error?: string;
};

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({
      authorized: false,
      message: 'Login required. Visit /login, then reload this endpoint.',
    }, { status: 401 });
  }

  const supabase = await getServerSupabase();

  async function checkSelect(table: string): Promise<CheckResult> {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) return { ok: false, error: `${error.code || ''}:${error.message}` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async function checkTaskWrite(): Promise<CheckResult> {
    const id = `diag:${userId}`;
    try {
      const { error } = await supabase.from('tasks').upsert({
        id,
        userid: userId,
        title: 'Diagnostics task',
        type: 'review',
        status: 'open',
        createdat: Date.now(),
      }, { onConflict: 'id' });
      if (error) return { ok: false, error: `${error.code || ''}:${error.message}` };
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', id);
      if (delErr) return { ok: false, error: `delete:${delErr.code || ''}:${delErr.message}` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  const results = {
    authorized: true,
    tables: {
      mailboxes: await checkSelect('mailboxes'),
      emailIdentities: await checkSelect('emailIdentities'),
      messages: await checkSelect('messages'),
      inventory: await checkSelect('inventory'),
      accounts: await checkSelect('accounts'),
      accountEvidence: await checkSelect('accountEvidence'),
      tasks: await checkSelect('tasks'),
      actionLogs: await checkSelect('actionLogs'),
      serviceAliases: await checkSelect('serviceAliases'),
    },
    rls: {
      canInsertAndDeleteTask: await checkTaskWrite(),
    },
    info: {
      note: 'If any table shows ok=false with code 42P01, the table does not exist. For 42501, RLS blocks access.',
    },
  };

  return NextResponse.json(results);
}
