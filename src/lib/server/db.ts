import { getServerSupabase } from '@/lib/server/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

export type Provider = 'gmail' | 'outlook';

export type Mailbox = {
  id: string; // doc id
  userId: string; // Supabase Auth UID
  provider: Provider;
  email: string;
  tokenBlobEncrypted: string; // encrypted tokens
  cursor?: string; // gmail historyId or graph deltaToken
  connectedAt: number;
  lastSyncAt?: number;
  displayName?: string;
};

export type Message = {
  id: string; // doc id
  mailboxId: string;
  providerMsgId: string;
  from?: string;
  to?: string;
  subject?: string;
  receivedAt: number;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  dkimDomain?: string;
  rootDomain?: string;
  category?: 'marketing' | 'account' | 'transactional' | 'updates' | 'other';
  aiStatus?: string;
  aiVersion?: string;
  aiHash?: string;
  aiProcessedAt?: number;
  aiError?: string;
  preFilterScore?: number;
};

export type Inventory = {
  id: string; // doc id
  mailboxId: string;
  rootDomain: string;
  displayName?: string;
  firstSeen: number;
  lastSeen: number;
  msgCount: number;
  hasUnsub: boolean;
  changeEmailUrl?: string;
  status: 'active' | 'moved' | 'ignored';
};

export type SyncRunMode = 'quick' | 'full' | 'delta';

export type SyncRunStatus = 'queued' | 'running' | 'paused' | 'done' | 'error' | 'needs_reauth';

export type SyncRunStage = 'listing' | 'fetching' | 'upserting' | 'aggregating';

export type SyncRun = {
  id: string;
  userId: string;
  mailboxId: string;
  mode: SyncRunMode;
  status: SyncRunStatus;
  startedAt: number;
  finishedAt?: number;
  stage: SyncRunStage;
  importedCount: number;
  domainCount: number;
  accountEvidenceCount: number;
  error?: string;
  cursorSnapshot?: unknown;
};

export type MailboxCursor = {
  mailboxId: string;
  userId: string;
  provider: Provider;
  backfill: unknown | null;
  delta: unknown | null;
  updatedAt: number;
};

export const mailboxesTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('mailboxes');
export const messagesTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('messages');
export const inventoryTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('inventory');
export const emailIdentitiesTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('emailIdentities');
export const accountsTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('accounts');
export const accountEvidenceTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('accountEvidence');
export const tasksTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('tasks');
export const actionLogsTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('actionLogs');
export const serviceAliasesTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('serviceAliases');
export const syncRunsTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('sync_runs');
export const mailboxCursorsTable = async (client?: SupabaseClient) => (client || await getServerSupabase()).from('mailbox_cursors');

export async function upsertMailbox(mb: Omit<Mailbox, 'id'> & { id?: string }): Promise<Mailbox> {
  const id = mb.id || (mb.provider + ':' + mb.email.toLowerCase());
  const dbDoc = {
    id,
    userid: mb.userId,
    provider: mb.provider,
    email: mb.email,
    tokenblobencrypted: mb.tokenBlobEncrypted,
    cursor: mb.cursor,
    connectedat: mb.connectedAt,
    lastsyncat: mb.lastSyncAt,
    displayname: mb.displayName,
  } as any;
  const { error } = await (await mailboxesTable()).upsert(dbDoc, { onConflict: 'id' });
  if (error) throw error;
  return { ...mb, id } as Mailbox;
}

export async function updateInventoryStatus(id: string, status: Inventory['status']) {
  const { error } = await (await inventoryTable()).update({ status }).eq('id', id);
  if (error) throw error;
}

export async function listInventory(filters?: {
  userId?: string;
  provider?: Provider;
  category?: Inventory['status']; // not ideal; category would be in message aggregation
  hasUnsub?: boolean;
  lastSeenAfter?: number;
}) {
  const supabase = await getServerSupabase();
  let query = supabase.from('inventory').select('*');
  if (filters?.userId) {
    // Filter inventory by user's mailbox IDs
    const { data: mbs, error } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('userid', filters.userId);
    if (error) throw error;
    const mailboxIds = (mbs ?? []).map(m => m.id);
    if (mailboxIds.length === 0) return [];
    query = query.in('mailboxid', mailboxIds);
  }
  if (filters?.hasUnsub !== undefined) query = query.eq('hasunsub', filters.hasUnsub);
  if (filters?.lastSeenAfter) query = query.gte('lastseen', filters.lastSeenAfter);
  const { data, error } = await query.order('lastseen', { ascending: false }).limit(500);
  if (error) throw error;
  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    mailboxId: row.mailboxid,
    rootDomain: row.rootdomain,
    displayName: row.displayname ?? undefined,
    firstSeen: row.firstseen,
    lastSeen: row.lastseen,
    msgCount: row.msgcount,
    hasUnsub: row.hasunsub,
    changeEmailUrl: row.changeemailurl ?? undefined,
    status: row.status,
  })) as Inventory[];
  return mapped;
}

export type EmailIdentity = {
  id: string;
  userId: string;
  email: string;
  provider: Provider;
  mailboxId: string;
  verifiedAt?: number;
  createdAt: number;
};

export type Account = {
  id: string;
  userId: string;
  emailIdentityId: string;
  serviceName: string;
  serviceDomain: string;
  category: 'bank'|'social'|'ecommerce'|'saas'|'subscription'|'other';
  confidenceScore: number;
  explanation: string;
  firstSeenAt: number;
  lastSeenAt: number;
  status: 'active'|'dormant'|'closed'|'unknown';
};

export type AccountEvidence = {
  id: string;
  userId: string;
  accountId: string;
  mailboxId: string;
  messageId: string;
  evidenceType: 'welcome'|'verify'|'login'|'reset'|'billing'|'security'|'newsletter'|'other';
  excerpt?: string;
  signals: Record<string, unknown>;
  weight: number;
  createdAt: number;
};

export type Task = {
  id: string;
  userId: string;
  accountId?: string;
  title: string;
  type: 'unsubscribe'|'close_account'|'update_email'|'enable_2fa'|'review';
  status: 'open'|'in_progress'|'done'|'dismissed';
  dueAt?: number;
  createdAt: number;
};

export type ActionLog = {
  id: string;
  userId: string;
  accountId?: string;
  mailboxId?: string;
  actionType: string;
  executionMode: 'http'|'mailto'|'link'|'manual'|'api';
  target?: string;
  status: 'success'|'fail'|'noop';
  error?: string;
  createdAt: number;
};

export type AiQueueItem = {
  id: string;
  mailboxId: string;
  messageId: string;
  status: 'queued'|'processing'|'done'|'error';
  priority: number;
  attempts: number;
  nextAttemptAt: number;
  lockedUntil?: number;
  createdAt: number;
};

export type ActionItemRow = {
  id: string;
  mailboxId: string;
  messageId: string;
  type: string;
  title: string;
  dedupHash?: string;
  surfacePriority?: number;
  snoozedUntil?: number;
  dueAt?: number;
  amount?: number;
  currency?: string;
  actionUrl?: string;
  confidence: number;
  reasoning?: string;
  createdAt: number;
};

export const aiQueueTable = async () => (await getServerSupabase()).from('ai_queue');
export const actionItemsTable = async () => (await getServerSupabase()).from('action_items');

export async function upsertEmailIdentity(input: Omit<EmailIdentity, 'id'|'createdAt'> & { id?: string }) {
  const id = input.id || (`${input.provider}:${input.email.toLowerCase()}`);
  const doc = {
    id,
    userid: input.userId,
    email: input.email,
    provider: input.provider,
    mailboxid: input.mailboxId,
    verifiedat: input.verifiedAt,
    createdat: Date.now(),
  } as any;
  const { error } = await (await emailIdentitiesTable()).upsert(doc, { onConflict: 'id' });
  if (error) throw error;
  return {
    id,
    userId: input.userId,
    email: input.email,
    provider: input.provider,
    mailboxId: input.mailboxId,
    verifiedAt: input.verifiedAt,
    createdAt: Date.now(),
  } as EmailIdentity;
}
