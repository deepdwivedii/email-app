import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ messages: [] }, { status: 200 });

  const url = new URL(req.url);
  const pageParam = Number(url.searchParams.get('page') || '1');
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await mailboxesTable();
  const { data: mbs, error: mbError } = await supabase.select('*').eq('userid', userId);
  if (mbError) {
    return NextResponse.json({ messages: [], error: mbError.message }, { status: 500 });
  }

  const mailboxes = mbs ?? [];
  if (!mailboxes.length) {
    return NextResponse.json({ messages: [] }, { status: 200 });
  }

  const mailboxIds = mailboxes.map(m => m.id as string);
  const messageClient = await messagesTable();
  const { data: rows, error: msgError, count } = await messageClient
    .select('*', { count: 'exact' })
    .in('mailboxid', mailboxIds)
    .order('receivedat', { ascending: false })
    .range(from, to);

  if (msgError) {
    return NextResponse.json({ messages: [], error: msgError.message }, { status: 500 });
  }

  const mailboxMap = new Map<string, { email: string; provider: string }>();
  for (const m of mailboxes) {
    mailboxMap.set(m.id as string, {
      email: m.email as string,
      provider: m.provider as string,
    });
  }

  const messages = (rows ?? []).map(m => {
    const meta = mailboxMap.get(m.mailboxid as string);
    return {
      id: m.id as string,
      mailboxId: m.mailboxid as string,
      mailboxEmail: meta?.email ?? null,
      mailboxProvider: meta?.provider ?? null,
      providerMsgId: m.providermsgid as string,
      from: m.from ?? '',
      to: m.to ?? '',
      subject: m.subject ?? '',
      receivedAt: m.receivedat as number,
      listUnsubscribe: m.listunsubscribe ?? null,
      listUnsubscribePost: m.listunsubscribepost ?? null,
      rootDomain: m.rootdomain ?? null,
      category: m.category ?? null,
      aiStatus: m.ai_status ?? null,
      aiProcessedAt: m.ai_processed_at ?? null,
      aiError: m.ai_error ?? null,
    };
  });

  return NextResponse.json({
    messages,
    page,
    pageSize,
    total: count ?? messages.length,
  });
}
