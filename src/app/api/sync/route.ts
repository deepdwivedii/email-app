import { NextRequest, NextResponse } from 'next/server';
import { mailboxesCol, messagesCol, inventoryCol, emailIdentitiesCol, type Mailbox } from '@/lib/server/db';
import { classifyMessage } from '@/lib/server/classify';
import { recordEvidenceAndInfer } from '@/lib/server/infer';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import { OAuth2Client } from 'google-auth-library';
import { FieldValue } from 'firebase-admin/firestore';
import { extractRegistrableDomain } from '@/lib/server/domain';
import { fetchWithRetry } from '@/lib/server/fetch';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';

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
  await msgRef.set(
    {
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
    },
    { merge: true }
  );

  const rootDomain = extractRegistrableDomain(msg.from);
  if (!rootDomain) return;
  const invId = `${mb.id}:${rootDomain}`;
  const invRef = inventoryCol().doc(invId);
  await invRef.set(
    {
      id: invId,
      mailboxId: mb.id,
      rootDomain,
      firstSeen: FieldValue.serverTimestamp(),
      lastSeen: msg.receivedAt,
      msgCount: FieldValue.increment(1),
      hasUnsub: !!msg.listUnsubscribe,
      status: 'active',
    },
    { merge: true }
  );
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

export async function POST(req: NextRequest) {
  type SyncResults = { gmail: number; outlook: number; errors: string[]; lastSynced: number };
  const results: SyncResults = { gmail: 0, outlook: 0, errors: [], lastSynced: Date.now() };
  const currentMailboxId = req.cookies.get('mb')?.value;

  if (!currentMailboxId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const decoded = await getAuth(firebaseAdminApp).verifySessionCookie(sessionCookie, true).catch(() => null);
  const sessionUserId = decoded?.uid;
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const mbDoc = await mailboxesCol().doc(currentMailboxId).get();
  if (!mbDoc.exists || (mbDoc.data() as Mailbox).userId !== sessionUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Gmail sync (metadata only)
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string | undefined;
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string | undefined;
    if (clientId && clientSecret) {
      const maybeDoc = await mailboxesCol().doc(currentMailboxId).get();
      const docs = maybeDoc.exists && (maybeDoc.data() as Mailbox).provider === 'gmail' ? [maybeDoc] : [];
      for (const doc of docs) {
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
          const listUrl =
            'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=newer_than:7d';
          const listRes = await fetchWithRetry(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (listRes.ok) {
            const listJson: { messages?: Array<{ id: string }> } = await listRes.json();
            const ids: string[] = (listJson.messages || []).map((m) => m.id);
            for (const id of ids) {
              const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
              const getRes = await fetchWithRetry(getUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
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
              results.gmail++;
            }
            await mailboxesCol().doc(mb.id).set({ lastSyncAt: Date.now() }, { merge: true });
          }
        } catch (e) {
          results.errors.push(`gmail:${mb.email}:${(e as Error)?.message || String(e)}`);
        }
      }
    }
  } catch (e) {
    results.errors.push(`gmail_global:${(e as Error)?.message || String(e)}`);
  }

  try {
    // Outlook sync (Graph)
    const clientId = process.env.MS_OAUTH_CLIENT_ID as string | undefined;
    const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET as string | undefined;
    if (clientId && clientSecret) {
      const maybeDoc = await mailboxesCol().doc(currentMailboxId).get();
      const docs = maybeDoc.exists && (maybeDoc.data() as Mailbox).provider === 'outlook' ? [maybeDoc] : [];
      for (const doc of docs) {
        const mb = doc.data() as Mailbox;
        try {
          type OutlookTokenBlob = { accessToken: string | null; refreshToken: string; expiresOn: string | null };
          const tokenBlob = decryptJson<OutlookTokenBlob>(mb.tokenBlobEncrypted);
          let accessToken: string | null = tokenBlob.accessToken || null;
          const fetchMessages = async (token: string) => {
            const url = `https://graph.microsoft.com/v1.0/me/messages?$select=id,subject,receivedDateTime,from,toRecipients&$top=20`;
            return fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
          };
          let res = await fetchMessages(accessToken!);
          if (res.status === 401 || res.status === 403) {
            const form = new URLSearchParams({
              client_id: clientId!,
              client_secret: clientSecret!,
              grant_type: 'refresh_token',
              refresh_token: tokenBlob.refreshToken,
              scope:
                'https://graph.microsoft.com/Mail.Read offline_access openid email profile',
            });
            const tr = await fetchWithRetry(
              'https://login.microsoftonline.com/common/oauth2/v2.0/token',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
              }
            );
            if (tr.ok) {
              const tj = await tr.json();
              accessToken = tj.access_token;
              // Persist refreshed tokens securely
              const newBlob = {
                accessToken: tj.access_token,
                refreshToken: tj.refresh_token || tokenBlob.refreshToken,
                expiresOn: tj.expires_in ? new Date(Date.now() + tj.expires_in * 1000).toISOString() : null,
              };
              await mailboxesCol().doc(mb.id).set(
                { tokenBlobEncrypted: encryptJson(newBlob) },
                { merge: true }
              );
              res = await fetchMessages(accessToken!);
            }
          }
          if (!res.ok) throw new Error(`Graph list failed ${res.status}`);
          const data: { value?: Array<{ id: string }> } = await res.json();
          for (const item of (data.value || [])) {
            const mRes = await fetchWithRetry(
              `https://graph.microsoft.com/v1.0/me/messages/${item.id}?$select=subject,receivedDateTime,from,toRecipients,internetMessageHeaders`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!mRes.ok) continue;
            const m = await mRes.json();
            const headersArr: Array<{ name: string; value: string }> = m.internetMessageHeaders || [];
            const headers: Record<string, string> = {};
            for (const h of headersArr) headers[h.name] = h.value;
            const dateVal = Date.parse(m.receivedDateTime);
            await upsertMessageAndInventory(mb, {
              providerMsgId: m.id,
              from: m.from?.emailAddress?.address,
              to: (m.toRecipients?.[0]?.emailAddress?.address) || undefined,
              subject: m.subject,
              receivedAt: isNaN(dateVal) ? Date.now() : dateVal,
              listUnsubscribe: headers['List-Unsubscribe'],
              listUnsubscribePost: headers['List-Unsubscribe-Post'],
            });
            results.outlook++;
          }
          await mailboxesCol().doc(mb.id).set({ lastSyncAt: Date.now() }, { merge: true });
        } catch (e) {
          results.errors.push(`outlook:${mb.email}:${(e as Error)?.message || String(e)}`);
        }
      }
    }
  } catch (e) {
    results.errors.push(`outlook_global:${(e as Error)?.message || String(e)}`);
  }

  return NextResponse.json(results);
}
