import { messagesTable, inventoryTable, emailIdentitiesTable, type Mailbox, type Inventory } from '@/lib/server/db';
import { classifyMessage } from '@/lib/server/classify';
import { recordEvidenceAndInfer } from '@/lib/server/infer';
import { extractRegistrableDomain } from '@/lib/server/domain';

export async function upsertMessageAndInventory(mb: Mailbox, msg: {
  providerMsgId: string;
  from?: string;
  to?: string;
  subject?: string;
  receivedAt: number;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
}) {
  const msgId = `${mb.id}:${msg.providerMsgId}`;
  const msgResult = await (await messagesTable()).upsert({
    id: msgId,
    mailboxid: mb.id,
    providermsgid: msg.providerMsgId,
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    receivedat: msg.receivedAt,
    listunsubscribe: msg.listUnsubscribe,
    listunsubscribepost: msg.listUnsubscribePost,
    rootdomain: extractRegistrableDomain(msg.from || ''),
  }, { onConflict: 'id' });
  if (msgResult.error) {
    throw msgResult.error;
  }

  const rootDomain = extractRegistrableDomain(msg.from || '');
  if (!rootDomain) return;
  const invId = `${mb.id}:${rootDomain}`;

  const invSelect = await (await inventoryTable())
    .select('id,msgcount,hasunsub,status')
    .eq('id', invId)
    .maybeSingle();
  if (invSelect.error) {
    throw invSelect.error;
  }
  const invRow = invSelect.data as { id: string; msgcount: number | null; hasunsub: boolean | null; status: string | null } | null;

  if (!invRow) {
    const insertResult = await (await inventoryTable()).insert({
      id: invId,
      mailboxid: mb.id,
      rootdomain: rootDomain,
      firstseen: Date.now(),
      lastseen: msg.receivedAt,
      msgcount: 1,
      hasunsub: !!msg.listUnsubscribe,
      status: 'active',
    } as any);
    if (insertResult.error) {
      throw insertResult.error;
    }
  } else {
    const updateResult = await (await inventoryTable()).update({
      lastseen: msg.receivedAt,
      msgcount: (invRow.msgcount ?? 0) + 1,
      hasunsub: !!invRow.hasunsub || !!msg.listUnsubscribe,
      status: invRow.status ?? 'active',
    } as any).eq('id', invId);
    if (updateResult.error) {
      throw updateResult.error;
    }
  }

  const idsResult = await (await emailIdentitiesTable()).select('id').eq('mailboxid', mb.id).limit(1);
  if (idsResult.error) {
    throw idsResult.error;
  }
  let emailIdentityId = idsResult.data && idsResult.data[0]?.id as string | undefined;

  if (!emailIdentityId) {
    const insertIdentity = await (await emailIdentitiesTable()).insert({
      id: `${mb.provider}:${mb.email.toLowerCase()}`,
      userid: mb.userId,
      email: mb.email,
      provider: mb.provider,
      mailboxid: mb.id,
      createdat: Date.now(),
    }).select('id').single();
    if (insertIdentity.error) {
      throw insertIdentity.error;
    }
    emailIdentityId = insertIdentity.data?.id as string | undefined;
  }

  if (!emailIdentityId) return;

  const classification = classifyMessage({
    from: msg.from,
    subject: msg.subject,
    listUnsubscribe: msg.listUnsubscribe,
    listUnsubscribePost: msg.listUnsubscribePost,
  });
  await recordEvidenceAndInfer({
    userId: mb.userId,
    mailboxId: mb.id,
    emailIdentityId,
    rootDomain,
    intent: classification.intent,
    weight: classification.weight,
    messageId: msgId,
    subject: msg.subject,
    from: msg.from,
    receivedAt: msg.receivedAt,
    signals: classification.signals,
  });
}
