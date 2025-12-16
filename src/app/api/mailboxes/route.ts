import { NextRequest, NextResponse } from 'next/server';
import { mailboxesTable, emailIdentitiesTable } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import { OAuth2Client } from 'google-auth-library';
import { fetchWithRetry } from '@/lib/server/fetch';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ mailboxes: [], identities: [] });
  const activeMailboxId = req.cookies.get('mb')?.value || null;
  const [{ data: mailboxes }, { data: identities }] = await Promise.all([
    (await mailboxesTable()).select('*').eq('userid', userId),
    (await emailIdentitiesTable()).select('*').eq('userid', userId),
  ]);

  const clientIdG = process.env.GMAIL_OAUTH_CLIENT_ID as string | undefined;
  const clientSecretG = process.env.GMAIL_OAUTH_CLIENT_SECRET as string | undefined;
  const clientIdM = process.env.MS_OAUTH_CLIENT_ID as string | undefined;
  const clientSecretM = process.env.MS_OAUTH_CLIENT_SECRET as string | undefined;

  const enriched: Array<{ id: string; provider: 'gmail'|'outlook'; email: string; connectedAt: number; lastSyncAt?: number; health: 'active'|'error'; statusText?: string; isActive: boolean }> = await Promise.all((mailboxes ?? []).map(async (row: any) => {
    const mb = {
      id: row.id as string,
      provider: row.provider as 'gmail'|'outlook',
      email: row.email as string,
      tokenBlobEncrypted: row.tokenblobencrypted as string,
      connectedAt: Number(row.connectedat) as number,
      lastSyncAt: row.lastsyncat ? Number(row.lastsyncat) : undefined,
    };
    let health: 'active' | 'error' = 'active';
    let statusText: string | undefined;
    try {
      if (mb.provider === 'gmail' && clientIdG && clientSecretG) {
        type GmailTokenBlob = { access_token: string; refresh_token: string };
        const tokens = decryptJson<GmailTokenBlob>(mb.tokenBlobEncrypted);
        const oauth = new OAuth2Client({ clientId: clientIdG, clientSecret: clientSecretG });
        oauth.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
        const fresh = await oauth.getAccessToken();
        const accessToken = fresh?.token || tokens.access_token;
        const res = await fetchWithRetry('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          health = 'error';
          statusText = `Gmail auth ${res.status}`;
        }
      } else if (mb.provider === 'outlook' && clientIdM && clientSecretM) {
        type OutlookTokenBlob = { accessToken: string | null; refreshToken: string; expiresOn: string | null };
        const tokenBlob = decryptJson<OutlookTokenBlob>(mb.tokenBlobEncrypted);
        let accessToken: string | null = tokenBlob.accessToken || null;
        const check = async (token: string) =>
          fetchWithRetry('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${token}` } });
        let res = await check(accessToken!);
        if (res.status === 401 || res.status === 403) {
          const form = new URLSearchParams({
            client_id: clientIdM!,
            client_secret: clientSecretM!,
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
            const newBlob = {
              accessToken: tj.access_token,
              refreshToken: tj.refresh_token || tokenBlob.refreshToken,
              expiresOn: tj.expires_in ? new Date(Date.now() + tj.expires_in * 1000).toISOString() : null,
            };
            await (await mailboxesTable()).update({ tokenblobencrypted: encryptJson(newBlob) }).eq('id', mb.id);
            res = await check(accessToken!);
          }
        }
        if (!res.ok) {
          health = 'error';
          statusText = `Outlook auth ${res.status}`;
        }
      }
    } catch (e) {
      health = 'error';
      statusText = (e as Error)?.message || 'Verification failed';
    }
    return { id: mb.id, provider: mb.provider, email: mb.email, connectedAt: mb.connectedAt, lastSyncAt: mb.lastSyncAt, health, statusText, isActive: activeMailboxId === mb.id };
  }));

  return NextResponse.json({ mailboxes: enriched, identities, activeMailboxId });
}
