import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, type Mailbox } from '@/lib/server/db';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import { OAuth2Client } from 'google-auth-library';
import { fetchWithRetry } from '@/lib/server/fetch';
import { getUserId } from '@/lib/server/auth';
import { upsertMessageAndInventory } from '@/lib/server/sync-shared';

const QUICK_MAX_MESSAGES_PER_PROVIDER = 40;
const FULL_MAX_MESSAGES_PER_PROVIDER = 200;
const SYNC_SOFT_RUNTIME_MS = 8000;

export async function POST(req: NextRequest) {
  type SyncResults = { gmail: number; outlook: number; errors: string[]; lastSynced: number };
  const results: SyncResults = { gmail: 0, outlook: 0, errors: [], lastSynced: Date.now() };
  const startedAt = Date.now();
  let softTimedOut = false;
  const isSoftTimedOut = () => Date.now() - startedAt >= SYNC_SOFT_RUNTIME_MS;
  const markSoftTimeout = () => {
    if (!softTimedOut) {
      softTimedOut = true;
      results.errors.push('sync:soft_timeout');
    }
  };
  let mode: 'quick' | 'full' = 'full';
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json() as { mode?: string };
      if (body && body.mode === 'quick') {
        mode = 'quick';
      }
    }
  } catch {}
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
    const mbRow = mbs && mbs[0];
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
    targetMailboxes = (mbs || []).map(mbRow => ({
      id: mbRow.id as string,
      userId: mbRow.userid as string,
      provider: mbRow.provider as Mailbox['provider'],
      email: mbRow.email as string,
      tokenBlobEncrypted: mbRow.tokenblobencrypted as string,
      cursor: (mbRow.cursor as string | null) ?? undefined,
      connectedAt: mbRow.connectedat as number,
      lastSyncAt: (mbRow.lastsyncat as number | null) ?? undefined,
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
        if (isSoftTimedOut()) {
          markSoftTimeout();
          break;
        }
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
          const maxMessages = mode === 'quick' ? QUICK_MAX_MESSAGES_PER_PROVIDER : FULL_MAX_MESSAGES_PER_PROVIDER;
          let fetchedGmail = 0;
          let pageToken: string | undefined;
          do {
            if (isSoftTimedOut()) {
              markSoftTimeout();
              break;
            }
            const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
            listUrl.searchParams.set('maxResults', '500');
            if (mode === 'quick') {
              listUrl.searchParams.set('q', 'newer_than:30d -in:chats');
            }
            if (pageToken) listUrl.searchParams.set('pageToken', pageToken);
            const listRes = await fetchWithRetry(listUrl.toString(), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!listRes.ok) {
              console.error('[Sync] Gmail list failed:', listRes.status, await listRes.text());
              break;
            }
            const listJson: { messages?: Array<{ id: string }>; nextPageToken?: string } = await listRes.json();
            const ids: string[] = (listJson.messages || []).map((m) => m.id);
            console.log('[Sync] Gmail page found messages:', ids.length);
            for (const id of ids) {
              if (isSoftTimedOut()) {
                markSoftTimeout();
                break;
              }
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
              fetchedGmail++;
              if (fetchedGmail >= maxMessages) break;
            }
            if (fetchedGmail >= maxMessages) break;
            pageToken = listJson.nextPageToken;
          } while (pageToken && fetchedGmail < maxMessages);
          console.log('[Sync] Updating Gmail mailbox lastSyncAt');
          await (await mailboxesTable()).update({ lastsyncat: Date.now() }).eq('id', mb.id);
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
        if (isSoftTimedOut()) {
          markSoftTimeout();
          break;
        }
        console.log('[Sync] Starting Outlook sync for:', mb.email);
        try {
          type OutlookTokenBlob = { accessToken: string | null; refreshToken: string; expiresOn: string | null };
          const tokenBlob = decryptJson<OutlookTokenBlob>(mb.tokenBlobEncrypted);
          let accessToken: string | null = tokenBlob.accessToken || null;
          const baseUrl = `https://graph.microsoft.com/v1.0/me/messages?$select=id,subject,receivedDateTime,from,toRecipients&$top=50`;
          const fetchMessages = async (token: string, url?: string) => {
            const target = url || baseUrl;
            return fetchWithRetry(target, { headers: { Authorization: `Bearer ${token}` } });
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
          const maxMessages = mode === 'quick' ? QUICK_MAX_MESSAGES_PER_PROVIDER : FULL_MAX_MESSAGES_PER_PROVIDER;
          let fetchedOutlook = 0;
          let nextLink: string | undefined;
          do {
            if (isSoftTimedOut()) {
              markSoftTimeout();
              break;
            }
            if (!res.ok) throw new Error(`Graph list failed ${res.status}`);
            const data: { value?: Array<{ id: string }>; '@odata.nextLink'?: string } = await res.json();
            const items = data.value || [];
            console.log('[Sync] Outlook page found messages:', items.length);
            for (const item of items) {
              if (isSoftTimedOut()) {
                markSoftTimeout();
                break;
              }
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
              fetchedOutlook++;
              if (fetchedOutlook >= maxMessages) break;
            }
            if (fetchedOutlook >= maxMessages) break;
            nextLink = data['@odata.nextLink'];
            if (nextLink) {
              res = await fetchMessages(accessToken!, nextLink);
            } else {
              break;
            }
          } while (fetchedOutlook < maxMessages);
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
