import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, messagesTable, inventoryTable, emailIdentitiesTable, type Mailbox, type Inventory } from '@/lib/server/db';
import { classifyMessage } from '@/lib/server/classify';
import { recordEvidenceAndInfer } from '@/lib/server/infer';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import { OAuth2Client } from 'google-auth-library';
import { extractRegistrableDomain } from '@/lib/server/domain';
import { fetchWithRetry } from '@/lib/server/fetch';
import { getUserId } from '@/lib/server/auth';

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
  await messagesTable().upsert({
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
  }).eq('id', msgId);

  const rootDomain = extractRegistrableDomain(msg.from);
  if (!rootDomain) return;
  const invId = `${mb.id}:${rootDomain}`;
  const { data: invs } = await inventoryTable().select('*').eq('id', invId).limit(1);
  const existing = (invs && invs[0]) as Inventory | undefined;
  if (!existing) {
    await inventoryTable().insert({
      id: invId,
      mailboxId: mb.id,
      rootDomain,
      firstSeen: Date.now(),
      lastSeen: msg.receivedAt,
      msgCount: 1,
      hasUnsub: !!msg.listUnsubscribe,
      status: 'active',
    });
  } else {
    await inventoryTable().update({
      lastSeen: msg.receivedAt,
      msgCount: (existing.msgCount || 0) + 1,
      hasUnsub: existing.hasUnsub || !!msg.listUnsubscribe,
      status: existing.status || 'active',
    }).eq('id', invId);
  }
  try {
    const { data: ids } = await emailIdentitiesTable().select('id').eq('mailboxId', mb.id).limit(1);
    const emailIdentityId = ids && ids[0]?.id;
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

  const sessionUserId = await getUserId(req);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: mbs } = await mailboxesTable().select('*').eq('id', currentMailboxId).limit(1);
  const mbDoc = (mbs && mbs[0]) as Mailbox | undefined;
  if (!mbDoc || mbDoc.userId !== sessionUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Gmail sync (metadata only)
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string | undefined;
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string | undefined;
    if (clientId && clientSecret) {
      const maybe = mbDoc && mbDoc.provider === 'gmail' ? [mbDoc] : [];
      for (const mb of maybe) {
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
            await mailboxesTable().update({ lastSyncAt: Date.now() }).eq('id', mb.id);
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
      const maybe = mbDoc && mbDoc.provider === 'outlook' ? [mbDoc] : [];
      for (const mb of maybe) {
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
              await mailboxesTable().update({ tokenBlobEncrypted: encryptJson(newBlob) }).eq('id', mb.id);
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
          await mailboxesTable().update({ lastSyncAt: Date.now() }).eq('id', mb.id);
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
