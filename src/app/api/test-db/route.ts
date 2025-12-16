import { NextRequest, NextResponse } from 'next/server';
import { actionLogsTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated', authorized: false }, { status: 401 });
    }

    const id = `test-${Date.now()}`;
    // 1. Try Insert
    const { error: insertError } = await (await actionLogsTable()).insert({
      id,
      userid: userId,
      actiontype: 'db_test',
      executionmode: 'manual',
      status: 'success',
      createdat: Date.now(),
    } as any);

    if (insertError) {
      return NextResponse.json({ 
        authorized: true, 
        writeSuccess: false, 
        error: insertError 
      }, { status: 500 });
    }

    // 2. Try Read
    const { data, error: readError } = await (await actionLogsTable())
      .select('*')
      .eq('id', id)
      .limit(1);

    if (readError) {
      return NextResponse.json({ 
        authorized: true, 
        writeSuccess: true, 
        readSuccess: false, 
        error: readError 
      }, { status: 500 });
    }

    // 3. Cleanup (optional, keeping it for verification might be good)
    await (await actionLogsTable()).delete().eq('id', id);

    // DEBUG: Check mailboxes
    const { data: mbs } = await (await import('@/lib/server/db')).mailboxesTable().then(t => t.select('*').eq('userid', userId));

    return NextResponse.json({
      authorized: true,
      writeSuccess: true,
      readSuccess: true,
      record: data?.[0],
      mailboxes: mbs,
      message: 'Database connection and RLS policies are working correctly.'
    });

  } catch (e) {
    return NextResponse.json({ 
      error: (e as Error).message, 
      stack: (e as Error).stack 
    }, { status: 500 });
  }
}
