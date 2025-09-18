import { firestore } from '@/lib/server/firebase-admin';

export type Provider = 'gmail' | 'outlook';

export type Mailbox = {
  id: string; // doc id
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
  provider?: Provider;
  category?: Inventory['status']; // not ideal; category would be in message aggregation
  hasUnsub?: boolean;
  lastSeenAfter?: number;
}) {
  let q: FirebaseFirestore.Query = inventoryCol();
  if (filters?.hasUnsub !== undefined) q = q.where('hasUnsub', '==', filters.hasUnsub);
  if (filters?.lastSeenAfter) q = q.where('lastSeen', '>=', filters.lastSeenAfter);
  // provider/category filters would require joins; skip for now or denormalize later
  const snap = await q.orderBy('lastSeen', 'desc').limit(500).get();
  return snap.docs.map(d => d.data() as Inventory);
}