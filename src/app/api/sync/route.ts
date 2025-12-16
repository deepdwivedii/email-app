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
  // console.log('[Sync] Upserting msg to DB:', msgId);
  await (await messagesTable()).upsert({
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

  const rootDomain = extractRegistrableDomain(msg.from || '');
  if (!rootDomain) return;
  const invId = `${mb.id}:${rootDomain}`;
  const { data: invs } = await (await inventoryTable()).select('*').eq('id', invId).limit(1);
  const existing = (invs && invs[0]) as Inventory | undefined;
  if (!existing) {
    await (await inventoryTable()).insert({
      id: invId,
      mailboxid: mb.id,
      rootdomain: rootDomain,
      firstseen: Date.now(),
      lastseen: msg.receivedAt,
      msgcount: 1,
      hasunsub: !!msg.listUnsubscribe,
      status: 'active',
    } as any);
  } else {
    await (await inventoryTable()).update({
      lastseen: msg.receivedAt,
      msgcount: (existing.msgCount || 0) + 1,
      hasunsub: existing.hasUnsub || !!msg.listUnsubscribe,
      status: existing.status || 'active',
    } as any).eq('id', invId);
  }
  try {
    const { data: ids } = await (await emailIdentitiesTable()).select('id').eq('mailboxid', mb.id).limit(1);
    let emailIdentityId = ids && ids[0]?.id;

    // Auto-create identity if missing (should be created at auth, but failsafe)
    if (!emailIdentityId) {
        console.log('[Sync] Creating missing identity for:', mb.email);
        const { data: newId, error: createErr } = await (await emailIdentitiesTable()).insert({
            id: `${mb.provider}:${mb.email.toLowerCase()}`,
            userid: mb.userId,
            email: mb.email,
            provider: mb.provider,
            mailboxid: mb.id,
            createdat: Date.now(),
        }).select('id').single();
        if (newId) emailIdentityId = newId.id;
    }

    if (emailIdentityId) {
      const classification = classifyMessage({
        from: msg.from,
        subject: msg.subject,
        listUnsubscribe: msg.listUnsubscribe,
        listUnsubscribePost: msg.listUnsubscribePost,
      });
      // console.log('[Sync] Inferring account for:', rootDomain, 'intent:', classification.intent, 'weight:', classification.weight);
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

  let targetMailboxes: Mailbox[] = [];

  if (currentMailboxId) {
    const { data: mbs } = await (await mailboxesTable()).select('*').eq('id', currentMailboxId).limit(1);
    const mbRow = mbs && (mbs[0] as any);
    const mbDoc: Mailbox | undefined = mbRow ? {
      id: mbRow.id,
      userId: mbRow.userid,
      provider: mbRow.provider,
      email: mbRow.email,
      tokenBlobEncrypted: mbRow.tokenblobencrypted,
      cursor: mbRow.cursor ?? undefined,
      connectedAt: mbRow.connectedat,
      lastSyncAt: mbRow.lastsyncat ?? undefined,
    } : undefined;
    if (mbDoc && mbDoc.userId === sessionUserId) {
      targetMailboxes.push(mbDoc);
    }
  } else {
    // If no active mailbox cookie, sync all mailboxes for the user
    const { data: mbs } = await (await mailboxesTable()).select('*').eq('userid', sessionUserId);
    targetMailboxes = (mbs || []).map((mbRow: any) => ({
      id: mbRow.id,
      userId: mbRow.userid,
      provider: mbRow.provider,
      email: mbRow.email,
      tokenBlobEncrypted: mbRow.tokenblobencrypted,
      cursor: mbRow.cursor ?? undefined,
      connectedAt: mbRow.connectedat,
      lastSyncAt: mbRow.lastsyncat ?? undefined,
    }));
  }

  if (targetMailboxes.length === 0) {
     if (currentMailboxId) {
        return NextResponse.json({ error: 'Forbidden or not found' }, { status: 403 });
     } else {
        return NextResponse.json({ error: 'No mailboxes connected' }, { status: 400 });
     }
  }

  console.log('[Sync] Target mailboxes:', targetMailboxes.map(m => m.email));

  try {
    // Gmail sync (metadata only)
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string | undefined;
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string | undefined;
    if (clientId && clientSecret) {
      const maybe = targetMailboxes.filter(m => m.provider === 'gmail');
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
            'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50';
          const listRes = await fetchWithRetry(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (listRes.ok) {
            const listJson: { messages?: Array<{ id: string }> } = await listRes.json();
            const ids: string[] = (listJson.messages || []).map((m) => m.id);
            console.log('[Sync] Gmail found messages:', ids.length);
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
              // console.log('[Sync] Upserting message:', msg.id, headers['Subject']);
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
            console.log('[Sync] Updating Gmail mailbox lastSyncAt');
            await (await mailboxesTable()).update({ lastsyncat: Date.now() }).eq('id', mb.id);
          } else {
             console.error('[Sync] Gmail list failed:', listRes.status, await listRes.text());
          }
        } catch (e) {
          console.error('[Sync] Gmail error:', e);
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
      const maybe = targetMailboxes.filter(m => m.provider === 'outlook');
      for (const mb of maybe) {
        console.log('[Sync] Starting Outlook sync for:', mb.email);
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
              await (await mailboxesTable()).update({ tokenblobencrypted: encryptJson(newBlob) }).eq('id', mb.id);
              res = await fetchMessages(accessToken!);
            }
          }
          if (!res.ok) throw new Error(`Graph list failed ${res.status}`);
          const data: { value?: Array<{ id: string }> } = await res.json();
          console.log('[Sync] Outlook found messages:', (data.value || []).length);
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
        console.log('[Sync] Updating Outlook mailbox lastSyncAt');
        await (await mailboxesTable()).update({ lastsyncat: Date.now() }).eq('id', mb.id);
        } catch (e) {
          console.error('[Sync] Outlook error:', e);
          results.errors.push(`outlook:${mb.email}:${(e as Error)?.message || String(e)}`);
        }
      }
    }
  } catch (e) {
    results.errors.push(`outlook_global:${(e as Error)?.message || String(e)}`);
  }

  return NextResponse.json(results);
}
