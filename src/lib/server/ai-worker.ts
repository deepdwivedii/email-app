import crypto from 'crypto';
import { aiQueueTable, actionItemsTable, messagesTable, type AiQueueItem } from '@/lib/server/db';
import { extractEmailActions } from '@/ai/flows/email-action-items';

type SupabaseRow = Record<string, unknown>;

function mapQueueRow(row: SupabaseRow): AiQueueItem {
  return {
    id: String(row.id),
    mailboxId: String(row.mailbox_id),
    messageId: String(row.message_id),
    status: row.status as AiQueueItem['status'],
    priority: Number(row.priority ?? 50),
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: new Date(String(row.next_attempt_at)).getTime(),
    lockedUntil: row.locked_until ? new Date(String(row.locked_until)).getTime() : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
  };
}

export async function aiEnqueueRecentMessages(maxPerBatch = 50, days = 7): Promise<{ enqueued: number }> {
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const msgTable = await messagesTable();
  const msgRes = await msgTable
    .select('id,mailboxid,receivedat,ai_status')
    .is('ai_status', null)
    .gte('receivedat', sinceMs)
    .order('receivedat', { ascending: false })
    .limit(maxPerBatch);
  if (msgRes.error) throw msgRes.error;
  const msgRows = (msgRes.data || []) as SupabaseRow[];
  if (!msgRows.length) {
    return { enqueued: 0 };
  }
  const messageIds = msgRows.map(m => String(m.id));
  const queue = await aiQueueTable();
  const existingRes = await queue
    .select('message_id')
    .in('message_id', messageIds);
  if (existingRes.error) throw existingRes.error;
  const existingRows = existingRes.data || [];
  const existingIds = new Set<string>(existingRows.map(r => String((r as SupabaseRow).message_id)));
  const toInsert = msgRows.filter(m => !existingIds.has(String(m.id)));
  if (!toInsert.length) {
    return { enqueued: 0 };
  }
  const nowIso = new Date().toISOString();
  const payload = toInsert.map(m => ({
    mailbox_id: m.mailboxid,
    message_id: m.id,
    status: 'queued',
    priority: 50,
    attempts: 0,
    next_attempt_at: nowIso,
  }));
  const insertRes = await queue.insert(payload as unknown[]);
  if (insertRes.error) throw insertRes.error;
  const updateRes = await msgTable
    .update({ ai_status: 'queued' })
    .in('id', toInsert.map(m => String(m.id)));
  if (updateRes.error) throw updateRes.error;
  return { enqueued: toInsert.length };
}

export async function aiWorkerTick(maxPerBatch = 20): Promise<{ processed: number }> {
  const nowIso = new Date().toISOString();
  const queue = await aiQueueTable();
  const selected = await queue
    .select('*')
    .eq('status', 'queued')
    .lte('next_attempt_at', nowIso)
    .order('priority', { ascending: true })
    .order('next_attempt_at', { ascending: true })
    .limit(maxPerBatch);
  if (selected.error) throw selected.error;
  const rows = (selected.data || []).map(mapQueueRow);
  if (!rows.length) {
    return { processed: 0 };
  }
  const ids = rows.map(r => r.id);
  const lockUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const lockRes = await queue
    .update({ status: 'processing', locked_until: lockUntil })
    .in('id', ids);
  if (lockRes.error) throw lockRes.error;

  const messageIds = rows.map(r => r.messageId);
  const msgTable = await messagesTable();
  const msgsRes = await msgTable
    .select('*')
    .in('id', messageIds);
  if (msgsRes.error) throw msgsRes.error;
  const messages = (msgsRes.data || []) as SupabaseRow[];

  const statusRes = await msgTable
    .update({ ai_status: 'processing' })
    .in('id', messageIds);
  if (statusRes.error) throw statusRes.error;

  try {
    const emails = messages.map(m => ({
      messageId: String(m.id),
      from: (m.from as string | null) || undefined,
      to: (m.to as string | null) || undefined,
      subject: (m.subject as string | null) || undefined,
      body: (m.subject as string | null) || '',
      listUnsubscribe: (m.listunsubscribe as string | null) || undefined,
    }));

    const result = await extractEmailActions(emails);
    const nowMs = Date.now();
    const actionTable = await actionItemsTable();

    for (const res of result.results || []) {
      const msgId = res.message_id;
      const msgRow = messages.find(m => String(m.id) === msgId);
      for (const action of res.actions || []) {
        const dedupSource = `${msgId}:${action.type}:${action.title}`;
        const dedupHash = crypto.createHash('sha256').update(dedupSource).digest('hex');
        const surfacePriority = 50;
        await actionTable.upsert(
          {
            mailbox_id: msgRow?.mailboxid,
            message_id: msgId,
            type: action.type,
            title: action.title,
            dedup_hash: dedupHash,
            surface_priority: surfacePriority,
            due_at: action.due_at ? new Date(action.due_at).toISOString() : null,
            amount: action.amount,
            currency: action.currency,
            action_url: action.action_url,
            confidence: action.confidence,
            reasoning: action.reasoning,
            created_at: new Date(nowMs).toISOString(),
          } as unknown,
          { onConflict: 'dedup_hash' }
        );
      }
    }

    const doneRes = await queue
      .update({ status: 'done', locked_until: null })
      .in('id', ids);
    if (doneRes.error) throw doneRes.error;

    const msgDoneRes = await msgTable
      .update({ ai_status: 'done', ai_processed_at: Date.now(), ai_error: null })
      .in('id', messageIds);
    if (msgDoneRes.error) throw msgDoneRes.error;

    return { processed: rows.length };
  } catch (e) {
    const errorString = e instanceof Error ? e.message : String(e);
    await queue
      .update({ status: 'error', locked_until: null })
      .in('id', ids);
    await msgTable
      .update({ ai_status: 'error', ai_error: errorString })
      .in('id', messageIds);
    throw e;
  }
}
