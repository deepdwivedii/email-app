import { getServerSupabase } from '@/lib/server/supabase';

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

export const mailboxesTable = async () => (await getServerSupabase()).from('mailboxes');
export const messagesTable = async () => (await getServerSupabase()).from('messages');
export const inventoryTable = async () => (await getServerSupabase()).from('inventory');
export const emailIdentitiesTable = async () => (await getServerSupabase()).from('emailIdentities');
export const accountsTable = async () => (await getServerSupabase()).from('accounts');
export const accountEvidenceTable = async () => (await getServerSupabase()).from('accountEvidence');
export const tasksTable = async () => (await getServerSupabase()).from('tasks');
export const actionLogsTable = async () => (await getServerSupabase()).from('actionLogs');
export const serviceAliasesTable = async () => (await getServerSupabase()).from('serviceAliases');

export async function upsertMailbox(mb: Omit<Mailbox, 'id'> & { id?: string }): Promise<Mailbox> {
  const id = mb.id || (mb.provider + ':' + mb.email.toLowerCase());
  const { error } = await (await mailboxesTable())
    .upsert({ ...mb, id })
    .eq('id', id);
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
      .eq('userId', filters.userId);
    if (error) throw error;
    const mailboxIds = (mbs ?? []).map(m => m.id);
    if (mailboxIds.length === 0) return [];
    query = query.in('mailboxId', mailboxIds);
  }
  if (filters?.hasUnsub !== undefined) query = query.eq('hasUnsub', filters.hasUnsub);
  if (filters?.lastSeenAfter) query = query.gte('lastSeen', filters.lastSeenAfter);
  const { data, error } = await query.order('lastSeen', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as Inventory[];
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

export async function upsertEmailIdentity(input: Omit<EmailIdentity, 'id'|'createdAt'> & { id?: string }) {
  const id = input.id || (`${input.provider}:${input.email.toLowerCase()}`);
  const doc = {
    id,
    userId: input.userId,
    email: input.email,
    provider: input.provider,
    mailboxId: input.mailboxId,
    verifiedAt: input.verifiedAt,
    createdAt: Date.now(),
  };
  const { error } = await (await emailIdentitiesTable()).upsert(doc).eq('id', id);
  if (error) throw error;
  return doc as EmailIdentity;
}
