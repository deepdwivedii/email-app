import { firestore } from '@/lib/server/firebase-admin';

export type Provider = 'gmail' | 'outlook';

export type Mailbox = {
  id: string; // doc id
  userId: string; // Firebase Auth UID
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

export const mailboxesCol = () => firestore.collection('mailboxes');
export const messagesCol = () => firestore.collection('messages');
export const inventoryCol = () => firestore.collection('inventory');
export const emailIdentitiesCol = () => firestore.collection('emailIdentities');
export const accountsCol = () => firestore.collection('accounts');
export const accountEvidenceCol = () => firestore.collection('accountEvidence');
export const tasksCol = () => firestore.collection('tasks');
export const actionLogsCol = () => firestore.collection('actionLogs');
export const serviceAliasesCol = () => firestore.collection('serviceAliases');

export async function upsertMailbox(mb: Omit<Mailbox, 'id'> & { id?: string }): Promise<Mailbox> {
  const id = mb.id || (mb.provider + ':' + mb.email.toLowerCase());
  const ref = mailboxesCol().doc(id);
  await ref.set({ ...mb, id }, { merge: true });
  return { ...mb, id } as Mailbox;
}

export async function updateInventoryStatus(id: string, status: Inventory['status']) {
  await inventoryCol().doc(id).set({ id, status }, { merge: true });
}

export async function listInventory(filters?: {
  userId?: string;
  provider?: Provider;
  category?: Inventory['status']; // not ideal; category would be in message aggregation
  hasUnsub?: boolean;
  lastSeenAfter?: number;
}) {
  let q: FirebaseFirestore.Query = inventoryCol();
  if (filters?.userId) {
    const userMailboxes = await mailboxesCol().where('userId', '==', filters.userId).get();
    const mailboxIds = userMailboxes.docs.map(doc => doc.id);
    if (mailboxIds.length > 0) {
      q = q.where('mailboxId', 'in', mailboxIds);
    } else {
      return []; // User has no mailboxes, so no inventory
    }
  }
  if (filters?.hasUnsub !== undefined) q = q.where('hasUnsub', '==', filters.hasUnsub);
  if (filters?.lastSeenAfter) q = q.where('lastSeen', '>=' , filters.lastSeenAfter);
  // provider/category filters would require joins; skip for now or denormalize later
  const snap = await q.orderBy('lastSeen', 'desc').limit(500).get();
  return snap.docs.map(d => d.data() as Inventory);
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
  const ref = emailIdentitiesCol().doc(id);
  const doc = {
    id,
    userId: input.userId,
    email: input.email,
    provider: input.provider,
    mailboxId: input.mailboxId,
    verifiedAt: input.verifiedAt,
    createdAt: Date.now(),
  };
  await ref.set(doc, { merge: true });
  return doc as EmailIdentity;
}
