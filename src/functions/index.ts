import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { mailboxesCol, messagesCol, inventoryCol, emailIdentitiesCol, type Mailbox } from '@/lib/server/db';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import { OAuth2Client } from 'google-auth-library';
import { FieldValue } from 'firebase-admin/firestore';
import { classifyMessage } from '@/lib/server/classify';
import { recordEvidenceAndInfer } from '@/lib/server/infer';
import { extractRegistrableDomain } from '@/lib/server/domain';
import { fetchWithRetry } from '@/lib/server/fetch';

// Helpers
// domain extraction moved to src/lib/server/domain.ts

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
    rootDomain: extractRegistrableDomain(msg.from),
  }, { merge: true });

  const rootDomain = extractRegistrableDomain(msg.from);
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

  try {
    const idSnap = await emailIdentitiesCol().where('mailboxId', '==', mb.id).limit(1).get();
    const emailIdentityId = idSnap.docs[0]?.id;
    if (emailIdentityId) {
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
  } catch {}
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
      type GmailTokenBlob = { access_token: string; refresh_token: string };
      const tokens = decryptJson<GmailTokenBlob>(mb.tokenBlobEncrypted);
      const oauth = new OAuth2Client({ clientId, clientSecret });
      oauth.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      const fresh = await oauth.getAccessToken();
      const accessToken = fresh?.token || tokens.access_token;

      let maxHistoryId = Number(mb.cursor || 0);

      if (mb.cursor) {
        // Incremental using Gmail History API
        let pageToken: string | undefined;
        let nextPageUrl: string | undefined = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(mb.cursor)}&historyTypes=messageAdded&maxResults=500`;
        while (nextPageUrl) {
          const hRes = await fetchWithRetry(nextPageUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!hRes.ok) {
            // If startHistoryId invalid (404), fall back to wide window search
            break;
          }
          const hJson: { history?: Array<{ historyId?: string | number; messages?: Array<{ id: string }> }>; nextPageToken?: string } = await hRes.json();
          for (const h of (hJson.history || [])) {
            if (h.historyId) {
              const hid = Number(h.historyId);
              if (!isNaN(hid)) maxHistoryId = Math.max(maxHistoryId, hid);
            }
            for (const m of (h.messages || [])) {
              const id = m.id;
              const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
              const getRes = await fetchWithRetry(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
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
              const msgHid = Number(msg.historyId);
              if (!isNaN(msgHid)) maxHistoryId = Math.max(maxHistoryId, msgHid);
            }
          }
          pageToken = hJson.nextPageToken;
          nextPageUrl = pageToken ? `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(mb.cursor)}&historyTypes=messageAdded&maxResults=500&pageToken=${encodeURIComponent(pageToken)}` : undefined;
        }
      }

      if (!maxHistoryId) {
        // Initial backfill: fetch metadata for last 24 months
        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=newer_than:720d`;
        const listRes = await fetchWithRetry(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (listRes.ok) {
          const listJson: { messages?: Array<{ id: string }> } = await listRes.json();
          const ids: string[] = (listJson.messages || []).map((m) => m.id);
          for (const id of ids) {
            const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
            const getRes = await fetchWithRetry(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
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
            const msgHid = Number(msg.historyId);
            if (!isNaN(msgHid)) maxHistoryId = Math.max(maxHistoryId, msgHid);
          }
        }
      }

      // Persist lastSyncAt and Gmail history cursor if we observed any
      const update: { lastSyncAt: number; cursor?: string } = { lastSyncAt: Date.now() };
      if (maxHistoryId && maxHistoryId > 0) update.cursor = String(maxHistoryId);
      await mailboxesCol().doc(mb.id).set(update, { merge: true });
    } catch (e) {
      logger.error(`Gmail sync failed for ${mb.email}: ${(e as Error)?.message || String(e)}`);
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
      type OutlookTokenBlob = { accessToken: string | null; refreshToken: string };
      const tokenBlob = decryptJson<OutlookTokenBlob>(mb.tokenBlobEncrypted);
      let accessToken: string | null = tokenBlob.accessToken || null;
      // Helper to perform authenticated fetch
      const authedFetch = async (url: string) => fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

      // Ensure access token is valid; refresh if needed
      const res = await authedFetch('https://graph.microsoft.com/v1.0/me');
      if (res.status === 401 || res.status === 403) {
        const form = new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: 'refresh_token',
          refresh_token: tokenBlob.refreshToken,
          scope: 'https://graph.microsoft.com/Mail.Read offline_access openid email profile',
        });
        const tr = await fetchWithRetry('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        if (tr.ok) {
          const tj = await tr.json();
          accessToken = tj.access_token;
          await mailboxesCol().doc(mb.id).set({
            tokenBlobEncrypted: encryptJson({
              ...tokenBlob,
              accessToken: tj.access_token,
              refreshToken: tj.refresh_token ?? tokenBlob.refreshToken,
            }),
          }, { merge: true }).catch(() => {});
        } else {
          throw new Error(`Token refresh failed ${tr.status}`);
        }
      }

      // Use delta token if we have one; otherwise start a new delta query
      const url = mb.cursor || `https://graph.microsoft.com/v1.0/me/messages/delta?$select=id,subject,receivedDateTime,from,toRecipients,internetMessageHeaders&$top=50`;
      let nextLink: string | undefined = url;
      let deltaLink: string | undefined;
      while (nextLink) {
        const pageRes = await authedFetch(nextLink);
        if (!pageRes.ok) throw new Error(`Graph delta failed ${pageRes.status}`);
        const data: { value?: Array<{ id: string; subject?: string; receivedDateTime: string; internetMessageHeaders?: Array<{ name: string; value: string }>; from?: { emailAddress?: { name?: string; address?: string } }; toRecipients?: Array<{ emailAddress?: { address?: string } }> }>; ['@odata.nextLink']?: string; ['@odata.deltaLink']?: string } = await pageRes.json();
        for (const m of (data.value || [])) {
          const headersArr: Array<{ name: string; value: string }> = m.internetMessageHeaders || [];
          const headers: Record<string, string> = {};
          for (const h of headersArr) headers[h.name] = h.value;
          const listUnsub = headers['List-Unsubscribe'];
          const listUnsubPost = headers['List-Unsubscribe-Post'];
          const fromStr = headers['From'] || (m.from?.emailAddress?.name && m.from?.emailAddress?.address ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>` : m.from?.emailAddress?.address);
          const toStr = headers['To'] || (Array.isArray(m.toRecipients) && m.toRecipients.length ? m.toRecipients.map((r) => r.emailAddress?.address).filter(Boolean).join(', ') : undefined);
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
        nextLink = data['@odata.nextLink'];
        deltaLink = data['@odata.deltaLink'] || deltaLink;
      }

      // Persist deltaLink cursor and lastSyncAt
      if (deltaLink) {
        await mailboxesCol().doc(mb.id).set({ cursor: deltaLink }, { merge: true });
      }
      await mailboxesCol().doc(mb.id).set({ lastSyncAt: Date.now() }, { merge: true });
    } catch (e) {
      logger.error(`Outlook sync failed for ${mb.email}: ${(e as Error)?.message || String(e)}`);
    }
  }
});
