import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { encryptJson } from '@/lib/server/crypto';
import { upsertMailbox, upsertEmailIdentity } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.redirect(`${origin}/auth?tab=signin&error=unauthorized`);
    }

    const redirectUri = `${origin}/api/oauth/google/callback`;
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string;
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string;
    const code = req.nextUrl.searchParams.get('code');
    const stateParam = req.nextUrl.searchParams.get('state');
    let alias: string | undefined;
    if (stateParam) {
      try {
        const json = Buffer.from(stateParam, 'base64url').toString('utf8');
        const parsed = JSON.parse(json) as { alias?: string };
        alias = parsed.alias?.trim() || undefined;
      } catch {
        alias = undefined;
      }
    }
    if (!clientId || !clientSecret || !code) {
      return NextResponse.redirect(`${origin}/overview?error=oauth_missing_params`);
    }
    const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
    const { tokens } = await client.getToken(code);

    const accessToken = tokens.access_token as string;
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error('Failed to fetch Gmail profile');
    const profile = await profileRes.json();
    const emailAddress = profile.emailAddress as string;
    const historyId = profile.historyId ? String(profile.historyId) : undefined;

    const tokenBlobEncrypted = encryptJson(tokens);
    const saved = await upsertMailbox({
      userId,
      provider: 'gmail',
      email: emailAddress,
      tokenBlobEncrypted,
      cursor: historyId,
      connectedAt: Date.now(),
      lastSyncAt: undefined,
      displayName: alias,
    });
    await upsertEmailIdentity({
      userId,
      email: emailAddress,
      provider: 'gmail',
      mailboxId: saved.id,
      verifiedAt: Date.now(),
    });

    const resp = NextResponse.redirect(`${origin}/overview?connected=gmail`);
    const secure = origin.startsWith('https://');
    // Set mailbox ID cookie to scope sync operations
    resp.cookies.set('mb', saved.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return resp;
  } catch (e) {
    const err = e as Error & { code?: string; status?: string; details?: string; hint?: string };
    const msg = err.message || String(e);
    const pgCode = err.code || err.status || undefined;
    const details = err.details || err.hint || undefined;
    console.error('Google OAuth callback error', { msg, pgCode, details });
    const coarse = msg.includes('profile') ? 'profile_fetch' : 'token_or_upsert_error';
    const codeParam = encodeURIComponent(pgCode ? `supabase_${pgCode}` : coarse);
    return NextResponse.redirect(`${req.nextUrl.origin}/overview?error=oauth_error&code=${codeParam}`);
  }
}
