import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { mailboxesCol, messagesCol, inventoryCol, type Mailbox } from '@/lib/server/db';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import { OAuth2Client } from 'google-auth-library';
import { FieldValue } from 'firebase-admin/firestore';

// Helpers
function getRootDomainFromFromHeader(from?: string): string | undefined {
  if (!from) return undefined;
  // try to extract email inside angle brackets or plain
  const match = from.match(/<([^>]+)>/);
  const email = (match ? match[1] : from).match(/[\w.+-]+@([\w.-]+)/);
  const domain = email?.[1]?.toLowerCase();
  if (!domain) return undefined;
  const parts = domain.split('.');
  if (parts.length >= 3) {
    const tld2 = ['co', 'com', 'org', 'net', 'gov', 'edu'];
    if (tld2.includes(parts[parts.length - 2])) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
  return domain;
}

async function upsertMessageAndInventory(mb: Mailbox, msg: {
  providerMsgId: string;
  from?: string;
  to?: string;
  subject?: string;
  receivedAt: number;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
}) {
  const msgId = `${mb.id}:${msg.providerMsgId}`;
  const msgRef = messagesCol().doc(msgId);
  await msgRef.set({
    id: msgId,
    mailboxId: mb.id,
    providerMsgId: msg.providerMsgId,
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    receivedAt: msg.receivedAt,
    listUnsubscribe: msg.listUnsubscribe,
    listUnsubscribePost: msg.listUnsubscribePost,
    rootDomain: getRootDomainFromFromHeader(msg.from),
  }, { merge: true });

  const rootDomain = getRootDomainFromFromHeader(msg.from);
  if (!rootDomain) return;
  const invId = `${mb.id}:${rootDomain}`;
  const invRef = inventoryCol().doc(invId);
  await invRef.set({
    id: invId,
    mailboxId: mb.id,
    rootDomain,
    firstSeen: FieldValue.serverTimestamp(),
    lastSeen: msg.receivedAt,
    msgCount: FieldValue.increment(1),
    hasUnsub: !!msg.listUnsubscribe,
    status: 'active',
  }, { merge: true });
}

// Gmail sync: fetch recent messages' metadata
export const syncGmailRecent = onSchedule({ schedule: 'every 10 minutes', timeoutSeconds: 240, memory: '512MiB' }, async () => {
  logger.info('syncGmailRecent tick');
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) {
    logger.warn('Missing GMAIL_OAUTH_CLIENT_ID/SECRET; skipping Gmail sync');
    return;
  }
  const snap = await mailboxesCol().where('provider', '==', 'gmail').limit(20).get();
  for (const doc of snap.docs) {
    const mb = doc.data() as Mailbox;
    try {
      const tokens = decryptJson<any>(mb.tokenBlobEncrypted);
      const oauth = new OAuth2Client({ clientId, clientSecret });
      oauth.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      const fresh = await oauth.getAccessToken();
      const accessToken = fresh?.token || tokens.access_token;
      const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=newer_than:7d';
      const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (listRes.ok) {
        const listJson: any = await listRes.json();
        const ids: string[] = (listJson.messages || []).map((m: any) => m.id);
        for (const id of ids) {
          const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
          const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!getRes.ok) continue;
          const msg = await getRes.json();
          const headers: Record<string, string> = {};
          for (const h of msg.payload?.headers || []) headers[h.name] = h.value;
          const dateVal = Date.parse(headers['Date']);
          await upsertMessageAndInventory(mb, {
            providerMsgId: msg.id,
            from: headers['From'],
            to: headers['To'],
            subject: headers['Subject'],
            receivedAt: isNaN(dateVal) ? Date.now() : dateVal,
            listUnsubscribe: headers['List-Unsubscribe'],
            listUnsubscribePost: headers['List-Unsubscribe-Post'],
          });
        }
      }
      await mailboxesCol().doc(mb.id).set({ lastSyncAt: Date.now() }, { merge: true });
    } catch (e: any) {
      logger.error(`Gmail sync failed for ${mb.email}: ${e?.message || e}`);
    }
  }
});

// Outlook sync: fetch recent messages and headers
export const syncOutlookDelta = onSchedule({ schedule: 'every 10 minutes', timeoutSeconds: 240, memory: '512MiB' }, async () => {
  logger.info('syncOutlookDelta tick');
  const clientId = process.env.MS_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) {
    logger.warn('Missing MS_OAUTH_CLIENT_ID/SECRET; skipping Outlook sync');
    return;
  }
  const snap = await mailboxesCol().where('provider', '==', 'outlook').limit(20).get();
  for (const doc of snap.docs) {
    const mb = doc.data() as Mailbox;
    try {
      const tokenBlob = decryptJson<any>(mb.tokenBlobEncrypted);
      let accessToken: string | null = tokenBlob.accessToken || null;
      // try using access token; if unauthorized, refresh using refresh_token grant
      const fetchMessages = async (token: string) => {
        const url = `https://graph.microsoft.com/v1.0/me/messages?$select=id,subject,receivedDateTime,from,toRecipients,hasAttachments&$top=25`;
        return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      };
      let res = await fetchMessages(accessToken!);
      if (res.status === 401 || res.status === 403) {
        // refresh via token endpoint
        const form = new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: 'refresh_token',
          refresh_token: tokenBlob.refreshToken,
          scope: 'https://graph.microsoft.com/Mail.Read offline_access openid email profile',
        });
        const tr = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        if (tr.ok) {
          const tj = await tr.json();
          accessToken = tj.access_token;
          // Persist refreshed token blob
          await mailboxesCol().doc(mb.id).set({
            tokenBlobEncrypted: encryptJson({
              ...tokenBlob,
              accessToken: tj.access_token,
              refreshToken: tj.refresh_token ?? tokenBlob.refreshToken,
            }),
          }, { merge: true }).catch(() => {});
          res = await fetchMessages(accessToken!);
        }
      }
      if (!res.ok) throw new Error(`Graph list failed ${res.status}`);
      const data: any = await res.json();
      for (const item of data.value || []) {
        // Need internetMessageHeaders; fetch full message headers for each id
        const mRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${item.id}?$select=subject,receivedDateTime,from,toRecipients,internetMessageHeaders`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mRes.ok) continue;
        const m = await mRes.json();
        const headersArr: Array<{ name: string; value: string }> = m.internetMessageHeaders || [];
        const headers: Record<string, string> = {};
        for (const h of headersArr) headers[h.name] = h.value;
        const listUnsub = headers['List-Unsubscribe'];
        const listUnsubPost = headers['List-Unsubscribe-Post'];
        const fromStr = headers['From'] || (m.from?.emailAddress?.name && m.from?.emailAddress?.address ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>` : m.from?.emailAddress?.address);
        const toStr = headers['To'] || (Array.isArray(m.toRecipients) && m.toRecipients.length ? m.toRecipients.map((r: any) => r.emailAddress?.address).join(', ') : undefined);
        await upsertMessageAndInventory(mb, {
          providerMsgId: m.id,
          from: fromStr || undefined,
          to: toStr || undefined,
          subject: m.subject,
          receivedAt: Date.parse(m.receivedDateTime) || Date.now(),
          listUnsubscribe: listUnsub,
          listUnsubscribePost: listUnsubPost,
        });
      }
      await mailboxesCol().doc(mb.id).set({ lastSyncAt: Date.now() }, { merge: true });
    } catch (e: any) {
      logger.error(`Outlook sync failed for ${mb.email}: ${e?.message || e}`);
    }
  }
});